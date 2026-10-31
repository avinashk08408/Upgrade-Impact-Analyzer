import fs from "node:fs/promises";
import path from "node:path";
import { ProjectScanner } from "../scanner/projectScanner.js";
import { DeclarationLoader } from "../diff/declarationLoader.js";
import { TypeDiffEngine } from "../diff/typeDiffEngine.js";
import { ImpactCorrelator } from "../engine/impactCorrelator.js";
import { RegistryFetcher } from "../utils/registry.js";
import { CodemodEngine } from "../cli/codemod.js";
import { CliffScanner } from "../cliff/scanner.js";
import { ManifestParser } from "../multilang/manifestParsers.js";
import { MultiLangRegistryClient } from "../multilang/registryClients.js";
import { MultiLangUsageScanner } from "../multilang/usageScanner.js";
function sendJson(res, statusCode, data) {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(data));
}
export function readBody(req, maxSizeBytes = 1024 * 1024) {
    // If body was already parsed by middleware or pre-attached
    if (req.body !== undefined && req.body !== null) {
        const existingBody = req.body;
        if (typeof existingBody === "string")
            return Promise.resolve(existingBody);
        return Promise.resolve(JSON.stringify(existingBody));
    }
    return new Promise((resolve, reject) => {
        let body = "";
        let receivedBytes = 0;
        let settled = false;
        // Timeout safety guard to avoid hanging the HTTP connection if stream is closed
        const timer = setTimeout(() => {
            if (!settled) {
                settled = true;
                resolve(body);
            }
        }, 10000);
        req.on("data", (chunk) => {
            receivedBytes += typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.length;
            if (receivedBytes > maxSizeBytes) {
                settled = true;
                clearTimeout(timer);
                req.destroy();
                const err = new Error("Payload Too Large: request body exceeds 1MB limit");
                err.statusCode = 413;
                reject(err);
                return;
            }
            body += chunk;
        });
        req.on("end", () => {
            if (!settled) {
                settled = true;
                clearTimeout(timer);
                resolve(body);
            }
        });
        req.on("error", (err) => {
            if (!settled) {
                settled = true;
                clearTimeout(timer);
                reject(err);
            }
        });
    });
}
export function isAllowedOrigin(req) {
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const secFetchSite = req.headers["sec-fetch-site"];
    if (secFetchSite === "cross-site") {
        return false;
    }
    const isLoopbackOrWebview = (target) => {
        if (!target)
            return false;
        if (target === "null" || target.startsWith("vscode-webview:"))
            return true;
        try {
            const u = new URL(target);
            return u.hostname === "localhost" || u.hostname === "127.0.0.1";
        }
        catch {
            return false;
        }
    };
    if (origin && !isLoopbackOrWebview(origin)) {
        return false;
    }
    if (referer && !isLoopbackOrWebview(referer)) {
        return false;
    }
    return true;
}
export function parseSemver(v) {
    if (!v || typeof v !== "string")
        return null;
    const clean = v.trim().replace(/^==\s*/, "").replace(/^v/, "");
    if (!clean || clean === "unknown" || clean === "latest")
        return null;
    // SemVer 2.0 with optional minor/patch: MAJOR.MINOR.PATCH(-PRERELEASE)?(+BUILD)?
    const match = clean.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
    if (!match)
        return null;
    const major = parseInt(match[1], 10);
    const minor = parseInt(match[2] || "0", 10);
    const patch = parseInt(match[3] || "0", 10);
    const prereleaseRaw = match[4];
    let prerelease = [];
    if (prereleaseRaw) {
        prerelease = prereleaseRaw.split(".").map((part) => {
            if (/^\d+$/.test(part)) {
                return parseInt(part, 10);
            }
            return part;
        });
    }
    return { major, minor, patch, prerelease };
}
export function compareSemver(aStr, bStr) {
    const a = parseSemver(aStr);
    const b = parseSemver(bStr);
    if (!a || !b)
        return null;
    if (a.major !== b.major)
        return a.major < b.major ? -1 : 1;
    if (a.minor !== b.minor)
        return a.minor < b.minor ? -1 : 1;
    if (a.patch !== b.patch)
        return a.patch < b.patch ? -1 : 1;
    // When major, minor, and patch are equal, a prerelease version has lower precedence than a normal version.
    const aHasPre = a.prerelease.length > 0;
    const bHasPre = b.prerelease.length > 0;
    if (aHasPre && !bHasPre)
        return -1;
    if (!aHasPre && bHasPre)
        return 1;
    if (!aHasPre && !bHasPre)
        return 0;
    // Both have prereleases: compare identifiers from left to right
    const minLen = Math.min(a.prerelease.length, b.prerelease.length);
    for (let i = 0; i < minLen; i++) {
        const idA = a.prerelease[i];
        const idB = b.prerelease[i];
        if (idA === idB)
            continue;
        const isNumA = typeof idA === "number";
        const isNumB = typeof idB === "number";
        if (isNumA && isNumB) {
            return idA < idB ? -1 : 1;
        }
        if (isNumA && !isNumB) {
            return -1;
        }
        if (!isNumA && isNumB) {
            return 1;
        }
        return idA < idB ? -1 : 1;
    }
    if (a.prerelease.length !== b.prerelease.length) {
        return a.prerelease.length < b.prerelease.length ? -1 : 1;
    }
    return 0;
}
export function isVersionOutdated(current, latest) {
    const cmp = compareSemver(current, latest);
    if (cmp === null) {
        return null; // Cannot determine
    }
    return cmp === -1;
}
/**
 * Determines whether a newer version from the registry fits within the manifest's declared range,
 * or requires manually updating the range (e.g. major version bump outside caret/tilde/pin).
 */
export function checkUpgradeRangeRelation(current, latest, requestedRange) {
    if (!requestedRange || requestedRange === "unknown" || requestedRange === "*" || requestedRange === "latest") {
        return "unknown";
    }
    const cleanRange = requestedRange.trim();
    const lat = parseSemver(latest);
    if (!lat)
        return "unknown";
    // Caret ranges: ^1.2.3, ^0.2.3, ^0.0.3
    if (cleanRange.startsWith("^")) {
        const base = parseSemver(cleanRange.slice(1).trim());
        if (!base)
            return "unknown";
        if (base.major > 0) {
            // ^1.2.3 allows >=1.2.3 <2.0.0
            return lat.major === base.major ? "in_range" : "out_of_range";
        }
        if (base.minor > 0) {
            // ^0.2.3 allows >=0.2.3 <0.3.0
            return (lat.major === 0 && lat.minor === base.minor) ? "in_range" : "out_of_range";
        }
        // ^0.0.3 allows >=0.0.3 <0.0.4
        return (lat.major === 0 && lat.minor === 0 && lat.patch === base.patch) ? "in_range" : "out_of_range";
    }
    // Tilde ranges: ~1.2.3, ~1.2
    if (cleanRange.startsWith("~")) {
        const base = parseSemver(cleanRange.slice(1).trim());
        if (!base)
            return "unknown";
        return (lat.major === base.major && lat.minor === base.minor) ? "in_range" : "out_of_range";
    }
    // Exact pins: ==1.2.3 or 1.2.3
    if (/^==?\s*[0-9]/.test(cleanRange) || /^[0-9]/.test(cleanRange)) {
        const pinnedVer = cleanRange.replace(/^==?\s*/, "").trim();
        const cmp = compareSemver(latest, pinnedVer);
        return cmp === 0 ? "in_range" : "out_of_range";
    }
    // Inequality ranges: >=1.2.0, <2.0.0
    if (cleanRange.startsWith("<")) {
        const upperLimit = cleanRange.replace(/^<=\s*|^<\s*/, "").trim();
        const cmp = compareSemver(latest, upperLimit);
        if (cmp === null)
            return "unknown";
        if (cleanRange.startsWith("<=")) {
            return cmp <= 0 ? "in_range" : "out_of_range";
        }
        return cmp < 0 ? "in_range" : "out_of_range";
    }
    return "unknown";
}
export async function handleApiRequest(req, res, projectPath = process.cwd()) {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const pathname = url.pathname;
    // 1. GET /api/status - Multi-language project dependency scan (JS/TS, Python, Rust, Go, PHP, Ruby)
    if (req.method === "GET" && pathname === "/api/status") {
        try {
            const discoveredDeps = await ManifestParser.discoverAllDependencies(projectPath);
            const packageList = await Promise.all(discoveredDeps.map(async (dep) => {
                const registryInfo = await MultiLangRegistryClient.getPackageMetadata(dep.name, dep.ecosystem);
                const isOutdated = isVersionOutdated(dep.currentVersion, registryInfo.latestVersion);
                let upgradeRelation = "unknown";
                if (isOutdated === true) {
                    upgradeRelation = checkUpgradeRangeRelation(dep.currentVersion, registryInfo.latestVersion, dep.requestedRange);
                }
                return {
                    id: dep.id,
                    name: dep.name,
                    currentVersion: dep.currentVersion,
                    requestedRange: dep.requestedRange,
                    isLockfileResolved: dep.isLockfileResolved,
                    isRangeOnly: dep.isRangeOnly,
                    dependencyGroup: dep.dependencyGroup,
                    latestVersion: registryInfo.latestVersion,
                    releaseDate: registryInfo.releaseDate,
                    isOutdated,
                    upgradeRelation,
                    ecosystem: dep.ecosystem,
                    language: dep.language,
                    manifestFile: dep.manifestFile
                };
            }));
            const uniqueLanguages = Array.from(new Set(packageList.map((p) => p.language)));
            sendJson(res, 200, {
                projectPath,
                projectName: path.basename(projectPath),
                languages: uniqueLanguages.length > 0 ? uniqueLanguages : ["General Repository"],
                totalPackages: packageList.length,
                outdatedCount: packageList.filter((p) => p.isOutdated === true).length,
                packages: packageList
            });
        }
        catch (err) {
            sendJson(res, 500, { error: `Multi-language scan error: ${err?.message || err}` });
        }
        return true;
    }
    // 2. POST /api/analyze - Multi-language upgrade impact analyzer
    if (req.method === "POST" && pathname === "/api/analyze") {
        try {
            const rawBody = await readBody(req);
            const body = JSON.parse(rawBody || "{}");
            const { packageName, targetVersion, fromVersion, ecosystem } = body;
            if (!packageName) {
                sendJson(res, 400, { error: "Missing required parameter: packageName" });
                return true;
            }
            const activeEcosystem = ecosystem || "npm";
            // Non-npm ecosystems (Python, Rust, Go, PHP, Ruby)
            if (activeEcosystem !== "npm") {
                const usages = await MultiLangUsageScanner.scanPackageUsages(projectPath, packageName, activeEcosystem);
                const items = usages.map((usage) => ({
                    usage,
                    breakingChange: {
                        category: "USAGE_AUDIT",
                        symbolName: usage.identifierName,
                        severity: "INFO",
                        description: `Active call-site for '${usage.identifierName}' detected in ${usage.filePath}:${usage.line}.`
                    },
                    upstreamRationale: `Identified explicit reference to '${usage.identifierName}' in your ${activeEcosystem.toUpperCase()} codebase. TypeScript compiler AST type diffing is active for npm; for ${activeEcosystem.toUpperCase()}, review official release migration notes for ${packageName}@${targetVersion}.`,
                    runtimeRisk: `If upstream maintainers altered the signature or return values of '${usage.identifierName}' in ${targetVersion}, this line could trigger a runtime failure upon upgrading.`,
                    remediation: {
                        beforeCode: usage.sourceSnippet,
                        afterCode: usage.sourceSnippet,
                        explanation: `Review the changelog for ${packageName}@${targetVersion} to verify whether '${usage.identifierName}' signature changed before upgrading in ${usage.filePath}.`,
                        isAutoFixable: false
                    }
                }));
                sendJson(res, 200, {
                    packageName,
                    currentVersion: fromVersion || "installed",
                    targetVersion: targetVersion || "latest",
                    ecosystem: activeEcosystem,
                    analysisType: "CALL_SITE_INVENTORY",
                    totalUpstreamChanges: 0,
                    affectedUsagesCount: items.length,
                    riskScore: items.length > 0 ? 25 : 0,
                    items,
                    scanScope: {
                        checkedVersions: { base: fromVersion || "installed", target: targetVersion || "latest" },
                        inspectedFileCount: new Set(usages.map((u) => u.filePath)).size,
                        uninspectedPatterns: ["Dynamic reflections and eval calls"],
                        disclaimer: `Scanned source files for explicit '${packageName}' call sites in ${activeEcosystem.toUpperCase()}. Deep AST declaration diffing is supported for TypeScript/npm; other ecosystems receive call-site inventories for migration review.`
                    }
                });
                return true;
            }
            // Default: npm / JavaScript / TypeScript AST pipeline
            const tsConfigCandidate = path.join(projectPath, "tsconfig.json");
            let scanner;
            try {
                await fs.access(tsConfigCandidate);
                scanner = new ProjectScanner(tsConfigCandidate);
            }
            catch {
                scanner = new ProjectScanner();
                scanner.addSourceFilesFromPattern(path.join(projectPath, "**/*.{ts,js,tsx,jsx}"));
            }
            const usages = scanner.scanForPackageUsage(packageName);
            const fetcher = new RegistryFetcher();
            let currentVersion = fromVersion || "installed";
            let oldDtsContent = "";
            const isCleanVersion = fromVersion && fromVersion !== "unknown" && !fromVersion.startsWith("^") && !fromVersion.startsWith("~") && !fromVersion.startsWith(">");
            if (isCleanVersion) {
                try {
                    const baseBundle = await fetcher.fetchPackageDeclarations(`${packageName}@${fromVersion}`);
                    oldDtsContent = baseBundle.entryDtsContent;
                    currentVersion = baseBundle.version;
                }
                catch {
                    oldDtsContent = "";
                }
            }
            if (!oldDtsContent) {
                const localPackageJson = path.join(projectPath, "node_modules", packageName, "package.json");
                try {
                    const localPkgJsonRaw = await fs.readFile(localPackageJson, "utf-8");
                    const localPkg = JSON.parse(localPkgJsonRaw);
                    currentVersion = localPkg.version || currentVersion || "installed";
                    const localDtsRel = localPkg.types || localPkg.typings || (localPkg.exports?.["."]?.types) || "index.d.ts";
                    const localDtsPath = path.join(projectPath, "node_modules", packageName, localDtsRel);
                    oldDtsContent = await fs.readFile(localDtsPath, "utf-8");
                }
                catch {
                    oldDtsContent = "";
                }
            }
            const targetSpec = targetVersion && targetVersion !== "latest" && targetVersion !== "unknown" ? `${packageName}@${targetVersion}` : packageName;
            const remoteBundle = await fetcher.fetchPackageDeclarations(targetSpec);
            const loader = new DeclarationLoader();
            const oldSymbols = loader.parseDeclarations(oldDtsContent, "old.d.ts");
            const newSymbols = loader.parseDeclarations(remoteBundle.entryDtsContent, "new.d.ts");
            const diffEngine = new TypeDiffEngine();
            const breakingChanges = diffEngine.diff(oldSymbols, newSymbols);
            const correlator = new ImpactCorrelator();
            const summary = correlator.correlate(packageName, currentVersion, remoteBundle.version, usages, breakingChanges);
            sendJson(res, 200, summary);
        }
        catch (err) {
            if (err.statusCode === 413 || err.message?.includes("Payload Too Large")) {
                sendJson(res, 413, { error: err.message || "Payload Too Large: request body exceeds 1MB limit" });
                return true;
            }
            sendJson(res, 500, { error: err?.message || String(err) });
        }
        return true;
    }
    // 3. POST /api/fix - Apply codemod safely
    if (req.method === "POST" && pathname === "/api/fix") {
        if (!isAllowedOrigin(req)) {
            sendJson(res, 403, { error: "Forbidden: Cross-origin modifying requests are blocked." });
            return true;
        }
        const contentType = req.headers["content-type"] || "";
        if (!contentType.includes("application/json")) {
            sendJson(res, 415, { error: "Unsupported Media Type: Expected application/json" });
            return true;
        }
        try {
            const rawBody = await readBody(req);
            const body = JSON.parse(rawBody || "{}");
            const { item } = body;
            if (!item || !item.usage || !item.usage.filePath) {
                sendJson(res, 400, { error: "Missing item or filePath in payload" });
                return true;
            }
            const codemod = new CodemodEngine(projectPath);
            try {
                await codemod.validatePath(item.usage.filePath);
            }
            catch (err) {
                sendJson(res, 403, { error: err.message });
                return true;
            }
            const results = await codemod.applyFixes([item]);
            const result = results[0];
            if (result && result.success) {
                sendJson(res, 200, { success: true, message: result.message, backupPath: result.backupPath });
            }
            else {
                sendJson(res, 400, { success: false, message: result?.message || "Remediation could not be applied." });
            }
        }
        catch (err) {
            if (err.statusCode === 413 || err.message?.includes("Payload Too Large")) {
                sendJson(res, 413, { error: err.message || "Payload Too Large: request body exceeds 1MB limit" });
                return true;
            }
            sendJson(res, 500, { error: err?.message || String(err) });
        }
        return true;
    }
    // 4. POST /api/undo-fix - Revert codemod
    if (req.method === "POST" && pathname === "/api/undo-fix") {
        if (!isAllowedOrigin(req)) {
            sendJson(res, 403, { error: "Forbidden: Cross-origin modifying requests are blocked." });
            return true;
        }
        const contentType = req.headers["content-type"] || "";
        if (!contentType.includes("application/json")) {
            sendJson(res, 415, { error: "Unsupported Media Type: Expected application/json" });
            return true;
        }
        try {
            const rawBody = await readBody(req);
            const body = JSON.parse(rawBody || "{}");
            const { filePath } = body;
            if (!filePath) {
                sendJson(res, 400, { error: "Missing filePath in payload" });
                return true;
            }
            const codemod = new CodemodEngine(projectPath);
            const result = await codemod.revertFix(filePath);
            if (result.success) {
                sendJson(res, 200, { success: true, message: result.message });
            }
            else {
                sendJson(res, 400, { success: false, message: result.message });
            }
        }
        catch (err) {
            if (err.statusCode === 413 || err.message?.includes("Payload Too Large")) {
                sendJson(res, 413, { error: err.message || "Payload Too Large: request body exceeds 1MB limit" });
                return true;
            }
            sendJson(res, 500, { error: err?.message || String(err) });
        }
        return true;
    }
    // 5. GET /api/cliff/scan - Free-tier cliff scanner
    if (req.method === "GET" && pathname === "/api/cliff/scan") {
        try {
            const scanner = new CliffScanner(projectPath);
            const summary = await scanner.scan();
            sendJson(res, 200, summary);
        }
        catch (err) {
            sendJson(res, 500, { error: err?.message || String(err) });
        }
        return true;
    }
    return false;
}
//# sourceMappingURL=apiHandler.js.map