import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_CLIFF_RULES } from "./rules.js";
const IGNORED_SCAN_DIRS = new Set([
    "node_modules",
    ".git",
    ".svn",
    ".hg",
    ".idea",
    ".vscode",
    "dist",
    "build",
    ".next",
    ".turbo",
    ".output",
    "out",
    "target",
    "vendor",
    "bin",
    "obj",
    ".cache",
    "tmp",
    "temp",
    "coverage",
    ".venv",
    "venv",
    "env"
]);
const KNOWN_CONFIG_BASENAMES = new Set([
    "render.yaml",
    "render.yml",
    "vercel.json",
    "fly.toml",
    "railway.json",
    "railway.toml",
    "netlify.toml",
    "wrangler.toml",
    "Procfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    "schema.prisma",
    "next.config.js",
    "next.config.mjs",
    "next.config.ts"
]);
const KNOWN_MANIFEST_BASENAMES = new Set([
    "package.json",
    "requirements.txt",
    "pyproject.toml",
    "Pipfile",
    "Cargo.toml",
    "composer.json",
    "Gemfile",
    "go.mod"
]);
/**
 * Sanitizes any raw string to guarantee secrets, credentials, or authentication tokens are never exposed.
 */
export function sanitizeSecretValues(input) {
    if (!input)
        return "";
    let cleaned = input;
    // Redact database connection passwords: protocol://user:password@host
    cleaned = cleaned.replace(/((?:postgres|postgresql|mongodb(?:\+srv)?|mysql|redis):\/\/[^:\s\/]+):([^@\s]+)@/gi, "$1:***@");
    // Redact JWT tokens (header.payload.signature)
    cleaned = cleaned.replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, "[REDACTED_JWT]");
    // Redact assignment lines like KEY=secret_value
    cleaned = cleaned.replace(/^(\s*[A-Za-z0-9_]*(?:KEY|SECRET|TOKEN|PASS|PASSWORD|AUTH|PRIVATE)[A-Za-z0-9_]*\s*=\s*)(.+)$/gim, "$1[REDACTED]");
    return cleaned.trim();
}
/**
 * Parses variable names from an environment file line-by-line, strictly ignoring secret values.
 */
function extractEnvVariableNames(content) {
    const envKeys = new Set();
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#"))
            continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
            const key = trimmed.substring(0, eqIdx).trim();
            if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
                envKeys.add(key);
            }
        }
    }
    return envKeys;
}
/**
 * Extracts dependencies declared across package manifests (npm, Python, Rust, Go, PHP, Ruby).
 */
function extractManifestDependencies(fileName, content) {
    const deps = {};
    const base = path.basename(fileName);
    if (base === "package.json") {
        try {
            const parsed = JSON.parse(content);
            const all = {
                ...(parsed.dependencies || {}),
                ...(parsed.devDependencies || {}),
                ...(parsed.peerDependencies || {}),
                ...(parsed.optionalDependencies || {})
            };
            for (const [k, v] of Object.entries(all)) {
                if (typeof v === "string")
                    deps[k] = v;
            }
        }
        catch {
            // Malformed package.json
        }
        return deps;
    }
    if (base === "requirements.txt") {
        const lines = content.split(/\r?\n/);
        for (const line of lines) {
            const clean = line.trim();
            if (!clean || clean.startsWith("#") || clean.startsWith("-"))
                continue;
            const match = clean.match(/^([A-Za-z0-9_.-]+)/);
            if (match) {
                deps[match[1].toLowerCase()] = clean;
            }
        }
        return deps;
    }
    if (base === "Pipfile") {
        const lines = content.split(/\r?\n/);
        let inPackages = false;
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("[packages]") || trimmed.startsWith("[dev-packages]")) {
                inPackages = true;
                continue;
            }
            else if (trimmed.startsWith("[")) {
                inPackages = false;
                continue;
            }
            if (inPackages) {
                const match = trimmed.match(/^([A-Za-z0-9_.-]+)\s*=/);
                if (match)
                    deps[match[1].toLowerCase()] = "pipfile";
            }
        }
        return deps;
    }
    if (base === "Cargo.toml") {
        const lines = content.split(/\r?\n/);
        let inDeps = false;
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("[dependencies]") || trimmed.startsWith("[dev-dependencies]")) {
                inDeps = true;
                continue;
            }
            else if (trimmed.startsWith("[")) {
                inDeps = false;
                continue;
            }
            if (inDeps) {
                const match = trimmed.match(/^([A-Za-z0-9_.-]+)\s*=/);
                if (match)
                    deps[match[1].toLowerCase()] = "cargo";
            }
        }
        return deps;
    }
    if (base === "composer.json") {
        try {
            const parsed = JSON.parse(content);
            const all = { ...(parsed.require || {}), ...(parsed["require-dev"] || {}) };
            for (const [k, v] of Object.entries(all)) {
                if (typeof v === "string")
                    deps[k.toLowerCase()] = v;
            }
        }
        catch {
            // Malformed composer.json
        }
        return deps;
    }
    if (base === "Gemfile") {
        const lines = content.split(/\r?\n/);
        for (const line of lines) {
            const match = line.match(/^\s*gem\s+['"]([^'"]+)['"]/);
            if (match)
                deps[match[1].toLowerCase()] = "gem";
        }
        return deps;
    }
    if (base === "go.mod") {
        const lines = content.split(/\r?\n/);
        let inRequire = false;
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("require (")) {
                inRequire = true;
                continue;
            }
            if (inRequire && trimmed === ")") {
                inRequire = false;
                continue;
            }
            if (trimmed.startsWith("require ")) {
                const parts = trimmed.split(/\s+/);
                if (parts[1])
                    deps[parts[1]] = parts[2] || "mod";
            }
            else if (inRequire) {
                const parts = trimmed.split(/\s+/);
                if (parts[0])
                    deps[parts[0]] = parts[1] || "mod";
            }
        }
        return deps;
    }
    return deps;
}
export class CliffScanner {
    projectRoot;
    rules;
    constructor(projectRoot = process.cwd(), rules = DEFAULT_CLIFF_RULES) {
        this.projectRoot = path.resolve(projectRoot);
        this.rules = rules;
    }
    /**
     * Recursively discovers candidate configuration, manifest, and environment files in projectRoot and subfolders.
     * Skips node_modules, build output, version control, and temporary cache directories.
     */
    async findFilesRecursively(dir, maxDepth = 5, currentDepth = 0) {
        const matches = [];
        if (currentDepth > maxDepth)
            return matches;
        let entries;
        try {
            entries = await fs.readdir(dir, { withFileTypes: true });
        }
        catch {
            return matches;
        }
        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (IGNORED_SCAN_DIRS.has(entry.name) || (entry.name.startsWith(".") && entry.name !== ".github")) {
                    continue;
                }
                const sub = await this.findFilesRecursively(path.join(dir, entry.name), maxDepth, currentDepth + 1);
                matches.push(...sub);
            }
            else if (entry.isFile()) {
                const base = entry.name;
                const isEnvFile = base.startsWith(".env");
                const isConfig = KNOWN_CONFIG_BASENAMES.has(base);
                const isManifest = KNOWN_MANIFEST_BASENAMES.has(base);
                let isRuleFile = false;
                for (const rule of this.rules) {
                    if (rule.detectionPatterns.files?.some((f) => path.basename(f) === base)) {
                        isRuleFile = true;
                        break;
                    }
                }
                if (isEnvFile || isConfig || isManifest || isRuleFile) {
                    matches.push(path.join(dir, entry.name));
                }
            }
        }
        return matches;
    }
    async scan() {
        // Verify project directory exists
        try {
            await fs.access(this.projectRoot);
        }
        catch (err) {
            throw new Error(`Project root directory not accessible: ${this.projectRoot} (${err.message})`);
        }
        const filesScanned = [];
        const findings = [];
        // Discover candidate files recursively across root and subfolders
        const absoluteFiles = await this.findFilesRecursively(this.projectRoot, 5);
        // Map of relative path -> raw content (sanitized for safety)
        const fileContents = new Map();
        // Map of relative path -> extracted env variable keys (variable names only, never secrets)
        const fileEnvKeys = new Map();
        // Combined map of dependencyName -> manifest location
        const discoveredDependencies = new Map();
        for (const absPath of absoluteFiles) {
            const relPath = path.relative(this.projectRoot, absPath).replace(/\\/g, "/");
            try {
                const raw = await fs.readFile(absPath, "utf-8");
                fileContents.set(relPath, raw);
                filesScanned.push(relPath);
                const base = path.basename(absPath);
                if (base.startsWith(".env")) {
                    const keys = extractEnvVariableNames(raw);
                    fileEnvKeys.set(relPath, keys);
                }
                if (KNOWN_MANIFEST_BASENAMES.has(base)) {
                    const deps = extractManifestDependencies(relPath, raw);
                    for (const [depName, depVer] of Object.entries(deps)) {
                        discoveredDependencies.set(depName.toLowerCase(), { version: depVer, file: relPath });
                    }
                }
            }
            catch {
                // Unreadable file
            }
        }
        // Helper: checks if file content matches negative patterns (explicit paid tier declarations)
        const matchesNegativePattern = (content, negativePatterns) => {
            if (!negativePatterns || negativePatterns.length === 0)
                return false;
            const lower = content.toLowerCase();
            return negativePatterns.some((neg) => lower.includes(neg.toLowerCase()));
        };
        // Helper: checks if a path matches a target rule file definition (supports root and nested subfolders)
        const matchesTargetFile = (relPath, targetFile) => {
            const normalizedRel = relPath.replace(/\\/g, "/");
            const normalizedTarget = targetFile.replace(/\\/g, "/");
            return (normalizedRel === normalizedTarget ||
                path.basename(normalizedRel) === normalizedTarget ||
                normalizedRel.endsWith(`/${normalizedTarget}`));
        };
        // Evaluate rules
        for (const rule of this.rules) {
            const patterns = rule.detectionPatterns;
            let matched = false;
            // A. Check configuration files for explicit plan configuration
            if (patterns.files) {
                for (const reqFile of patterns.files) {
                    // Check all scanned files matching the target config name
                    for (const [relPath, content] of fileContents.entries()) {
                        if (!matchesTargetFile(relPath, reqFile))
                            continue;
                        // If this specific config file explicitly specifies a paid plan, skip it
                        if (matchesNegativePattern(content, patterns.negativeContentMatches)) {
                            continue;
                        }
                        const lower = content.toLowerCase();
                        const hasExplicitFree = lower.includes("plan: free") ||
                            lower.includes("auto_stop_machines = true") ||
                            lower.includes("auto_stop_machines = 'stop'");
                        findings.push({
                            rule,
                            confidence: hasExplicitFree ? "CONFIRMED_FREE_CONFIG" : "CONDITIONAL_ON_FREE_TIER",
                            confidenceLabel: hasExplicitFree
                                ? "Confirmed Free-Tier Configuration"
                                : `Conditional: Possible - Please Confirm (Applies if using ${rule.provider} Free Tier)`,
                            isConfirmed: hasExplicitFree,
                            matchedEvidence: {
                                file: relPath,
                                matchedPattern: path.basename(reqFile),
                                details: hasExplicitFree
                                    ? `Explicit free-tier configuration detected in ${relPath}.`
                                    : `Configuration file '${relPath}' detected. Applies if hosting on ${rule.provider} free plan.`
                            }
                        });
                        matched = true;
                        break;
                    }
                    if (matched)
                        break;
                }
            }
            if (matched)
                continue;
            // B. Check manifest dependencies across root and subfolders
            if (patterns.dependencies) {
                // If a relevant provider config file explicitly opts into a paid tier, skip dependency match
                let providerPaidPlanConfigured = false;
                if (patterns.files && patterns.negativeContentMatches) {
                    for (const reqFile of patterns.files) {
                        for (const [relPath, content] of fileContents.entries()) {
                            if (matchesTargetFile(relPath, reqFile) && matchesNegativePattern(content, patterns.negativeContentMatches)) {
                                providerPaidPlanConfigured = true;
                                break;
                            }
                        }
                        if (providerPaidPlanConfigured)
                            break;
                    }
                }
                if (!providerPaidPlanConfigured) {
                    for (const dep of patterns.dependencies) {
                        const found = discoveredDependencies.get(dep.toLowerCase());
                        if (found) {
                            findings.push({
                                rule,
                                confidence: "CONDITIONAL_ON_FREE_TIER",
                                confidenceLabel: `Conditional: Possible - Please Confirm (Applies if using ${rule.provider} Free Tier)`,
                                isConfirmed: false,
                                matchedEvidence: {
                                    file: found.file,
                                    matchedPattern: dep,
                                    details: `Dependency '${dep}' detected in ${found.file}. Project files do not specify plan tier; confirm whether this service uses ${rule.provider} Free Tier.`
                                }
                            });
                            matched = true;
                            break;
                        }
                    }
                }
            }
            if (matched)
                continue;
            // C. Check environment variable keys and sanitized domain content patterns
            for (const [filePath, content] of fileContents.entries()) {
                if (matchesNegativePattern(content, patterns.negativeContentMatches)) {
                    continue;
                }
                // Test environment variable names (keys only, never secrets)
                if (patterns.envVariables) {
                    const envKeys = fileEnvKeys.get(filePath);
                    for (const envKey of patterns.envVariables) {
                        const hasKey = envKeys ? envKeys.has(envKey) : content.includes(envKey);
                        if (hasKey) {
                            findings.push({
                                rule,
                                confidence: "CONDITIONAL_ON_FREE_TIER",
                                confidenceLabel: `Conditional: Possible - Please Confirm (Applies if using ${rule.provider} Free Tier)`,
                                isConfirmed: false,
                                matchedEvidence: {
                                    file: filePath,
                                    matchedPattern: envKey,
                                    details: `Environment variable name '${envKey}' declared in ${filePath} (secret values not read). Applies if using ${rule.provider} Free Tier.`
                                }
                            });
                            matched = true;
                            break;
                        }
                    }
                }
                if (matched)
                    break;
                // Test domain or content reference
                if (patterns.contentMatches) {
                    for (const snippet of patterns.contentMatches) {
                        if (content.toLowerCase().includes(snippet.toLowerCase())) {
                            // Ensure we do not display any secrets from the matching line
                            findings.push({
                                rule,
                                confidence: "CONDITIONAL_ON_FREE_TIER",
                                confidenceLabel: `Conditional: Possible - Please Confirm (Applies if using ${rule.provider} Free Tier)`,
                                isConfirmed: false,
                                matchedEvidence: {
                                    file: filePath,
                                    matchedPattern: snippet,
                                    details: `Reference to '${snippet}' identified in ${filePath}. Applies if using ${rule.provider} Free Tier.`
                                }
                            });
                            matched = true;
                            break;
                        }
                    }
                }
                if (matched)
                    break;
            }
        }
        return {
            projectPath: this.projectRoot,
            filesScanned,
            findingsCount: findings.length,
            findings,
            timestamp: new Date().toISOString()
        };
    }
}
//# sourceMappingURL=scanner.js.map