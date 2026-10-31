import fs from "node:fs/promises";
import path from "node:path";

export type Ecosystem = "npm" | "pypi" | "cargo" | "go" | "composer" | "rubygems";
export type DependencyGroup = "dependencies" | "devDependencies" | "peerDependencies" | "optionalDependencies";

export interface DiscoveredDependency {
  id: string;
  name: string;
  currentVersion: string;
  requestedRange?: string;
  isLockfileResolved: boolean;
  isRangeOnly: boolean;
  ecosystem: Ecosystem;
  language: string;
  manifestFile: string;
  dependencyGroup?: DependencyGroup;
}

export function isVersionRange(raw: string | undefined): boolean {
  if (!raw) return true;
  const trimmed = raw.trim();
  if (trimmed === "*" || trimmed === "latest" || trimmed === "" || trimmed === "unknown") {
    return true;
  }
  // Exact pin formats
  if (/^==\s*[0-9]/.test(trimmed)) {
    return false;
  }
  // If it starts with range operators ^, ~, >, <, !=
  if (/^[\^~><!]/.test(trimmed)) {
    return true;
  }
  // Multi-constraint or wildcard ranges
  if (/[,\|]|\s+-\s+|\.x|\.\*/i.test(trimmed)) {
    return true;
  }
  return false;
}

export function cleanVersion(raw: string | undefined): string {
  if (!raw) return "unknown";
  const trimmed = raw.trim();
  // Unlocked version ranges do not indicate an exact installed version
  if (isVersionRange(trimmed)) {
    return "unknown";
  }
  const cleaned = trimmed.replace(/^==\s*/, "").replace(/^v/, "").trim();
  return cleaned || "unknown";
}

// --- STANDALONE LOCKFILE LOADERS (for direct inspection) ---

export async function loadNpmLockfileVersions(filePath: string): Promise<Map<string, string>> {
  const versions = new Map<string, string>();
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed.packages) {
      for (const [key, val] of Object.entries(parsed.packages)) {
        if (!val || typeof val !== "object") continue;
        const v = (val as any).version;
        if (!v) continue;
        if (key.startsWith("node_modules/")) {
          const pkgName = key.replace(/^node_modules\//, "");
          if (!pkgName.includes("/node_modules/")) {
            versions.set(pkgName, v);
          }
        }
      }
    } else if (parsed.dependencies) {
      for (const [pkgName, val] of Object.entries(parsed.dependencies)) {
        const v = (val as any)?.version;
        if (v) versions.set(pkgName, v);
      }
    }
  } catch {
    // lockfile absent or unreadable
  }
  return versions;
}

export async function loadPnpmLockfileVersions(filePath: string): Promise<Map<string, string>> {
  const versions = new Map<string, string>();
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const lines = raw.split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*['"]?(?:\/)?(@?[^@\s'":]+)@([0-9a-zA-Z\.\-]+)(?:\(.*?\))?['"]?:/);
      if (match) {
        const name = match[1];
        const ver = match[2];
        if (!versions.has(name)) {
          versions.set(name, ver);
        }
      }
    }
  } catch {
    // lockfile absent
  }
  return versions;
}

export async function loadYarnLockfileVersions(filePath: string): Promise<Map<string, string>> {
  const versions = new Map<string, string>();
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const lines = raw.split("\n");
    let currentNames: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      if (!line.startsWith(" ") && !line.startsWith("\t") && trimmed.endsWith(":")) {
        currentNames = [];
        const cleanHeader = trimmed.slice(0, -1);
        const parts = cleanHeader.split(",");
        for (const part of parts) {
          const spec = part.trim().replace(/^["']|["']$/g, "");
          const atIdx = spec.indexOf("@", 1);
          if (atIdx > 0) {
            const name = spec.substring(0, atIdx);
            currentNames.push(name);
          }
        }
      } else if (currentNames.length > 0 && /^\s+version:?\s*["']?([0-9a-zA-Z\.\-]+)["']?/.test(line)) {
        const match = line.match(/^\s+version:?\s*["']?([0-9a-zA-Z\.\-]+)["']?/);
        if (match) {
          const ver = match[1];
          for (const name of currentNames) {
            if (!versions.has(name)) {
              versions.set(name, ver);
            }
          }
          currentNames = [];
        }
      }
    }
  } catch {
    // lockfile absent
  }
  return versions;
}

export async function loadCargoLockfileVersions(filePath: string): Promise<Map<string, string>> {
  const versions = new Map<string, string>();
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const lines = raw.split("\n");
    let currentName = "";
    for (const line of lines) {
      const trimmed = line.trim();
      const nameMatch = trimmed.match(/^name\s*=\s*"([^"]+)"/);
      if (nameMatch) {
        currentName = nameMatch[1];
      }
      const verMatch = trimmed.match(/^version\s*=\s*"([^"]+)"/);
      if (verMatch && currentName) {
        versions.set(currentName, verMatch[1]);
        currentName = "";
      }
    }
  } catch {
    // lockfile absent
  }
  return versions;
}

export async function loadComposerLockfileVersions(filePath: string): Promise<Map<string, string>> {
  const versions = new Map<string, string>();
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    const pkgs = [...(parsed.packages || []), ...(parsed["packages-dev"] || [])];
    for (const p of pkgs) {
      if (p.name && p.version) {
        versions.set(p.name, p.version.replace(/^v/, ""));
      }
    }
  } catch {
    // lockfile absent
  }
  return versions;
}

export async function loadPoetryLockfileVersions(filePath: string): Promise<Map<string, string>> {
  const versions = new Map<string, string>();
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const lines = raw.split("\n");
    let currentName = "";
    for (const line of lines) {
      const trimmed = line.trim();
      const nameMatch = trimmed.match(/^name\s*=\s*"([^"]+)"/);
      if (nameMatch) currentName = nameMatch[1];
      const verMatch = trimmed.match(/^version\s*=\s*"([^"]+)"/);
      if (verMatch && currentName) {
        versions.set(currentName, verMatch[1]);
        currentName = "";
      }
    }
  } catch {
    // lockfile absent
  }
  return versions;
}

export async function loadPipfileLockVersions(filePath: string): Promise<Map<string, string>> {
  const versions = new Map<string, string>();
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    const all = { ...(parsed.default || {}), ...(parsed.develop || {}) };
    for (const [name, info] of Object.entries(all)) {
      if (!info || typeof info !== "object") continue;
      const v = (info as any).version;
      if (typeof v === "string") {
        versions.set(name, v.replace(/^==/, "").trim());
      }
    }
  } catch {
    // lockfile absent
  }
  return versions;
}

export async function loadGemfileLockVersions(filePath: string): Promise<Map<string, string>> {
  const versions = new Map<string, string>();
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const lines = raw.split("\n");
    let inSpecs = false;

    for (const line of lines) {
      if (line.trim() === "specs:") {
        inSpecs = true;
        continue;
      }
      if (inSpecs && /^[A-Z]/.test(line.trim())) {
        inSpecs = false;
        continue;
      }

      if (inSpecs) {
        const match = line.match(/^\s{4}([a-zA-Z0-9_\-\.]+)\s*\(([0-9a-zA-Z\.\-]+)\)/);
        if (match) {
          const name = match[1];
          const ver = match[2];
          if (!versions.has(name)) {
            versions.set(name, ver);
          }
        }
      }
    }
  } catch {
    // lockfile absent
  }
  return versions;
}

export async function readNodeModulesVersion(
  manifestDir: string,
  projectRoot: string,
  pkgName: string
): Promise<string | null> {
  const localPkgPath = path.join(manifestDir, "node_modules", pkgName, "package.json");
  try {
    const raw = await fs.readFile(localPkgPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed.version && typeof parsed.version === "string") {
      return parsed.version;
    }
  } catch {
    // not in local node_modules
  }

  if (manifestDir !== projectRoot) {
    const rootPkgPath = path.join(projectRoot, "node_modules", pkgName, "package.json");
    try {
      const raw = await fs.readFile(rootPkgPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.version && typeof parsed.version === "string") {
        return parsed.version;
      }
    } catch {
      // not in root node_modules
    }
  }

  return null;
}

// --- HIERARCHICAL WORKSPACE-AWARE LOCKFILE RESOLVER ---

export class HierarchicalLockfileResolver {
  private jsonCache = new Map<string, any>();
  private textCache = new Map<string, string | null>();

  constructor(private projectRoot: string) {}

  private async loadJson(filePath: string): Promise<any> {
    if (this.jsonCache.has(filePath)) return this.jsonCache.get(filePath);
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      this.jsonCache.set(filePath, parsed);
      return parsed;
    } catch {
      this.jsonCache.set(filePath, null);
      return null;
    }
  }

  private async loadText(filePath: string): Promise<string | null> {
    if (this.textCache.has(filePath)) return this.textCache.get(filePath)!;
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      this.textCache.set(filePath, raw);
      return raw;
    } catch {
      this.textCache.set(filePath, null);
      return null;
    }
  }

  /**
   * Resolves exact npm locked version for a specific manifest.
   * Traverses only from manifestDir upwards to projectRoot, preventing sibling workspace contamination.
   */
  public async resolveNpm(
    manifestPath: string,
    pkgName: string
  ): Promise<{ version: string; lockfileLabel: string } | null> {
    const manifestDir = path.dirname(manifestPath);
    const relManifestDir = path.relative(this.projectRoot, manifestDir).replace(/\\/g, "/");

    let currentDir = manifestDir;
    while (true) {
      // 1. package-lock.json
      const pkgLockPath = path.join(currentDir, "package-lock.json");
      const pkgLock = await this.loadJson(pkgLockPath);
      if (pkgLock) {
        const lockfileRel = path.relative(this.projectRoot, pkgLockPath).replace(/\\/g, "/");

        // Workspace-scoped lookup in monorepo root package-lock.json
        if (currentDir === this.projectRoot && relManifestDir && relManifestDir !== ".") {
          const workspaceKey = `${relManifestDir}/node_modules/${pkgName}`;
          if (pkgLock.packages?.[workspaceKey]?.version) {
            return {
              version: pkgLock.packages[workspaceKey].version,
              lockfileLabel: `${lockfileRel} [${relManifestDir}]`
            };
          }
        }

        // Direct package-lock entry (in local folder or hoisted)
        if (pkgLock.packages?.[`node_modules/${pkgName}`]?.version) {
          return {
            version: pkgLock.packages[`node_modules/${pkgName}`].version,
            lockfileLabel: lockfileRel
          };
        }

        if (pkgLock.dependencies?.[pkgName]?.version) {
          return {
            version: pkgLock.dependencies[pkgName].version,
            lockfileLabel: lockfileRel
          };
        }
      }

      // 2. pnpm-lock.yaml
      const pnpmPath = path.join(currentDir, "pnpm-lock.yaml");
      const pnpmRaw = await this.loadText(pnpmPath);
      if (pnpmRaw) {
        const lockfileRel = path.relative(this.projectRoot, pnpmPath).replace(/\\/g, "/");
        const ver = this.matchPnpmVersion(pnpmRaw, pkgName, relManifestDir);
        if (ver) {
          return {
            version: ver,
            lockfileLabel: lockfileRel
          };
        }
      }

      // 3. yarn.lock
      const yarnPath = path.join(currentDir, "yarn.lock");
      const yarnRaw = await this.loadText(yarnPath);
      if (yarnRaw) {
        const lockfileRel = path.relative(this.projectRoot, yarnPath).replace(/\\/g, "/");
        const ver = this.matchYarnVersion(yarnRaw, pkgName);
        if (ver) {
          return {
            version: ver,
            lockfileLabel: lockfileRel
          };
        }
      }

      if (currentDir === this.projectRoot) break;
      const parent = path.dirname(currentDir);
      if (parent === currentDir || !parent.startsWith(this.projectRoot)) break;
      currentDir = parent;
    }

    // 4. Fallback: check node_modules on disk
    const nodeModulesVer = await readNodeModulesVersion(manifestDir, this.projectRoot, pkgName);
    if (nodeModulesVer) {
      return {
        version: nodeModulesVer,
        lockfileLabel: "node_modules"
      };
    }

    return null;
  }

  private matchPnpmVersion(pnpmRaw: string, pkgName: string, relManifestDir: string): string | null {
    // If pnpm-lock has importers section, check workspace importer first
    if (relManifestDir && relManifestDir !== "." && pnpmRaw.includes("importers:")) {
      const importerRegex = new RegExp(
        `importers:[\\s\\S]*?[\\r\\n]\\s+['"]?${relManifestDir}['"]?:[\\s\\S]*?(?:dependencies|devDependencies):([\\s\\S]*?)(?:(?:specifiers:|\\n\\w|importers:|packages:)|$)`
      );
      const importerMatch = pnpmRaw.match(importerRegex);
      if (importerMatch) {
        const depsBlock = importerMatch[1];
        const depMatch = depsBlock.match(
          new RegExp(`['"]?${pkgName}['"]?:[\\s\\S]*?version:\\s*['"]?([0-9a-zA-Z\\.\\-]+)`)
        );
        if (depMatch) return depMatch[1];
      }
    }

    // General packages section match
    const escaped = pkgName.replace(/[\/@]/g, "\\$&");
    const generalMatch = pnpmRaw.match(
      new RegExp(`['"]?(?:\\/)?${escaped}@([0-9a-zA-Z\\.\\-]+)(?:\\(.*?\\))?['"]?:`)
    );
    if (generalMatch) {
      return generalMatch[1];
    }
    return null;
  }

  private matchYarnVersion(yarnRaw: string, pkgName: string): string | null {
    const escaped = pkgName.replace(/[\/@]/g, "\\$&");
    const lines = yarnRaw.split("\n");
    let matchHeader = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!line.startsWith(" ") && !line.startsWith("\t") && trimmed.endsWith(":")) {
        matchHeader = new RegExp(`(^|[,\\s"'])${escaped}@`).test(trimmed);
      } else if (matchHeader && /^\s+version:?\s*["']?([0-9a-zA-Z\.\-]+)["']?/.test(line)) {
        const m = line.match(/^\s+version:?\s*["']?([0-9a-zA-Z\.\-]+)["']?/);
        if (m) return m[1];
      }
    }
    return null;
  }

  /**
   * Resolves exact Python locked version (poetry.lock, Pipfile.lock) for a specific manifest.
   */
  public async resolvePython(
    manifestPath: string,
    pkgName: string
  ): Promise<{ version: string; lockfileLabel: string } | null> {
    const manifestDir = path.dirname(manifestPath);
    let currentDir = manifestDir;

    while (true) {
      // poetry.lock
      const poetryPath = path.join(currentDir, "poetry.lock");
      const poetryRaw = await this.loadText(poetryPath);
      if (poetryRaw) {
        const lines = poetryRaw.split("\n");
        let currentPackage = "";
        for (const line of lines) {
          const mName = line.trim().match(/^name\s*=\s*"([^"]+)"/);
          if (mName) currentPackage = mName[1];
          const mVer = line.trim().match(/^version\s*=\s*"([^"]+)"/);
          if (mVer && currentPackage.toLowerCase() === pkgName.toLowerCase()) {
            const rel = path.relative(this.projectRoot, poetryPath).replace(/\\/g, "/");
            return { version: mVer[1], lockfileLabel: rel };
          }
        }
      }

      // Pipfile.lock
      const pipfilePath = path.join(currentDir, "Pipfile.lock");
      const pipfileJson = await this.loadJson(pipfilePath);
      if (pipfileJson) {
        const all = { ...(pipfileJson.default || {}), ...(pipfileJson.develop || {}) };
        if (all[pkgName]?.version) {
          const v = String(all[pkgName].version).replace(/^==/, "").trim();
          const rel = path.relative(this.projectRoot, pipfilePath).replace(/\\/g, "/");
          return { version: v, lockfileLabel: rel };
        }
      }

      if (currentDir === this.projectRoot) break;
      const parent = path.dirname(currentDir);
      if (parent === currentDir || !parent.startsWith(this.projectRoot)) break;
      currentDir = parent;
    }

    return null;
  }

  /**
   * Resolves exact Rust locked version (Cargo.lock) for a specific manifest.
   */
  public async resolveCargo(
    manifestPath: string,
    pkgName: string
  ): Promise<{ version: string; lockfileLabel: string } | null> {
    const manifestDir = path.dirname(manifestPath);
    let currentDir = manifestDir;

    while (true) {
      const cargoLockPath = path.join(currentDir, "Cargo.lock");
      const cargoRaw = await this.loadText(cargoLockPath);
      if (cargoRaw) {
        const lines = cargoRaw.split("\n");
        let currentPackage = "";
        for (const line of lines) {
          const mName = line.trim().match(/^name\s*=\s*"([^"]+)"/);
          if (mName) currentPackage = mName[1];
          const mVer = line.trim().match(/^version\s*=\s*"([^"]+)"/);
          if (mVer && currentPackage === pkgName) {
            const rel = path.relative(this.projectRoot, cargoLockPath).replace(/\\/g, "/");
            return { version: mVer[1], lockfileLabel: rel };
          }
        }
      }

      if (currentDir === this.projectRoot) break;
      const parent = path.dirname(currentDir);
      if (parent === currentDir || !parent.startsWith(this.projectRoot)) break;
      currentDir = parent;
    }

    return null;
  }

  /**
   * Resolves exact PHP locked version (composer.lock) for a specific manifest.
   */
  public async resolveComposer(
    manifestPath: string,
    pkgName: string
  ): Promise<{ version: string; lockfileLabel: string } | null> {
    const manifestDir = path.dirname(manifestPath);
    let currentDir = manifestDir;

    while (true) {
      const composerLockPath = path.join(currentDir, "composer.lock");
      const composerJson = await this.loadJson(composerLockPath);
      if (composerJson) {
        const pkgs = [...(composerJson.packages || []), ...(composerJson["packages-dev"] || [])];
        for (const p of pkgs) {
          if (p.name === pkgName && p.version) {
            const rel = path.relative(this.projectRoot, composerLockPath).replace(/\\/g, "/");
            return { version: p.version.replace(/^v/, ""), lockfileLabel: rel };
          }
        }
      }

      if (currentDir === this.projectRoot) break;
      const parent = path.dirname(currentDir);
      if (parent === currentDir || !parent.startsWith(this.projectRoot)) break;
      currentDir = parent;
    }

    return null;
  }

  /**
   * Resolves exact Ruby locked version (Gemfile.lock) for a specific manifest.
   */
  public async resolveGemfile(
    manifestPath: string,
    gemName: string
  ): Promise<{ version: string; lockfileLabel: string } | null> {
    const manifestDir = path.dirname(manifestPath);
    let currentDir = manifestDir;

    while (true) {
      const gemLockPath = path.join(currentDir, "Gemfile.lock");
      const gemRaw = await this.loadText(gemLockPath);
      if (gemRaw) {
        const lines = gemRaw.split("\n");
        let inSpecs = false;
        for (const line of lines) {
          if (line.trim() === "specs:") {
            inSpecs = true;
            continue;
          }
          if (inSpecs && /^[A-Z]/.test(line.trim())) {
            inSpecs = false;
            continue;
          }
          if (inSpecs) {
            const match = line.match(/^\s{4}([a-zA-Z0-9_\-\.]+)\s*\(([0-9a-zA-Z\.\-]+)\)/);
            if (match && match[1] === gemName) {
              const rel = path.relative(this.projectRoot, gemLockPath).replace(/\\/g, "/");
              return { version: match[2], lockfileLabel: rel };
            }
          }
        }
      }

      if (currentDir === this.projectRoot) break;
      const parent = path.dirname(currentDir);
      if (parent === currentDir || !parent.startsWith(this.projectRoot)) break;
      currentDir = parent;
    }

    return null;
  }
}

// --- FILE SYSTEM DISCOVERY ---

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".venv",
  "venv",
  "env",
  "target",
  "vendor",
  ".cache",
  "tmp",
  ".idea",
  ".vscode"
]);

const MANIFEST_NAMES = new Set([
  "package.json",
  "requirements.txt",
  "pyproject.toml",
  "Pipfile",
  "Cargo.toml",
  "go.mod",
  "composer.json",
  "Gemfile"
]);

async function findProjectFilesRecursively(
  dir: string,
  targetFileNames: Set<string>,
  maxDepth = 5,
  currentDepth = 0
): Promise<string[]> {
  const matches: string[] = [];
  if (currentDepth > maxDepth) return matches;

  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return matches;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith(".")) {
        continue;
      }
      const subMatches = await findProjectFilesRecursively(
        path.join(dir, entry.name),
        targetFileNames,
        maxDepth,
        currentDepth + 1
      );
      matches.push(...subMatches);
    } else if (entry.isFile()) {
      if (targetFileNames.has(entry.name)) {
        matches.push(path.join(dir, entry.name));
      }
    }
  }

  return matches;
}

export class ManifestParser {
  /**
   * Scans project directory recursively across Python, Rust, Go, PHP, Ruby, and JavaScript/TypeScript.
   * Lockfile resolution is workspace-scoped and hierarchical, ensuring monorepos never inherit sibling versions.
   */
  public static async discoverAllDependencies(projectRoot: string): Promise<DiscoveredDependency[]> {
    const resolvedRoot = path.resolve(projectRoot);
    const dependencies: DiscoveredDependency[] = [];

    const manifestPaths = await findProjectFilesRecursively(resolvedRoot, MANIFEST_NAMES, 4);
    const resolver = new HierarchicalLockfileResolver(resolvedRoot);

    for (const manifestPath of manifestPaths) {
      const relManifest = path.relative(resolvedRoot, manifestPath).replace(/\\/g, "/");
      const baseName = path.basename(manifestPath);

      // 1. JavaScript / TypeScript: package.json
      if (baseName === "package.json") {
        try {
          const raw = await fs.readFile(manifestPath, "utf-8");
          const parsed = JSON.parse(raw);

          const groups: Array<{ name: DependencyGroup; map: Record<string, string> }> = [
            { name: "dependencies", map: parsed.dependencies || {} },
            { name: "devDependencies", map: parsed.devDependencies || {} },
            { name: "peerDependencies", map: parsed.peerDependencies || {} },
            { name: "optionalDependencies", map: parsed.optionalDependencies || {} }
          ];

          const seenNames = new Set<string>();

          for (const group of groups) {
            for (const [name, ver] of Object.entries(group.map)) {
              if (seenNames.has(name)) continue;
              seenNames.add(name);

              const rawVer = typeof ver === "string" ? ver : "unknown";
              const locked = await resolver.resolveNpm(manifestPath, name);

              if (locked) {
                dependencies.push({
                  id: `npm:${relManifest}:${name}`,
                  name,
                  currentVersion: locked.version,
                  requestedRange: rawVer,
                  isLockfileResolved: true,
                  isRangeOnly: false,
                  ecosystem: "npm",
                  language: "JavaScript / TypeScript",
                  manifestFile: `${relManifest} (${locked.lockfileLabel})`,
                  dependencyGroup: group.name
                });
              } else {
                const isRange = isVersionRange(rawVer);
                const clean = cleanVersion(rawVer);
                dependencies.push({
                  id: `npm:${relManifest}:${name}`,
                  name,
                  currentVersion: clean,
                  requestedRange: rawVer,
                  isLockfileResolved: false,
                  isRangeOnly: isRange,
                  ecosystem: "npm",
                  language: "JavaScript / TypeScript",
                  manifestFile: relManifest,
                  dependencyGroup: group.name
                });
              }
            }
          }
        } catch {
          // ignore unreadable package.json
        }
      }

      // 2. Python: requirements.txt
      else if (baseName === "requirements.txt") {
        try {
          const raw = await fs.readFile(manifestPath, "utf-8");
          const lines = raw.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-")) continue;

            const match = trimmed.match(/^([a-zA-Z0-9_\-\.]+)(?:[=><~^!]+([a-zA-Z0-9_\-\.]+))?/);
            if (match) {
              const pkgName = match[1];
              const rawVer = match[2];
              const fullSpec = trimmed.slice(pkgName.length).trim() || rawVer || "*";
              const locked = await resolver.resolvePython(manifestPath, pkgName);

              if (locked) {
                dependencies.push({
                  id: `pypi:${relManifest}:${pkgName}`,
                  name: pkgName,
                  currentVersion: locked.version,
                  requestedRange: fullSpec,
                  isLockfileResolved: true,
                  isRangeOnly: false,
                  ecosystem: "pypi",
                  language: "Python",
                  manifestFile: `${relManifest} (${locked.lockfileLabel})`
                });
              } else {
                const isRange = isVersionRange(fullSpec);
                const clean = cleanVersion(fullSpec);
                dependencies.push({
                  id: `pypi:${relManifest}:${pkgName}`,
                  name: pkgName,
                  currentVersion: clean,
                  requestedRange: fullSpec,
                  isLockfileResolved: false,
                  isRangeOnly: isRange,
                  ecosystem: "pypi",
                  language: "Python",
                  manifestFile: relManifest
                });
              }
            }
          }
        } catch {
          // ignore
        }
      }

      // 3. Python: pyproject.toml
      else if (baseName === "pyproject.toml") {
        try {
          const raw = await fs.readFile(manifestPath, "utf-8");
          const lines = raw.split("\n");
          let inDepsList = false;
          let inPoetrySection = false;

          for (const line of lines) {
            const trimmed = line.trim();
            if (
              trimmed.startsWith("dependencies = [") ||
              trimmed.startsWith("dependencies=[") ||
              (trimmed === "[" && inDepsList)
            ) {
              inDepsList = true;
              continue;
            } else if (trimmed.startsWith("[tool.poetry.dependencies]")) {
              inPoetrySection = true;
              inDepsList = false;
              continue;
            } else if (trimmed.startsWith("[") && (inDepsList || inPoetrySection)) {
              inDepsList = false;
              inPoetrySection = false;
              continue;
            }

            if (inDepsList) {
              if (trimmed === "]") {
                inDepsList = false;
                continue;
              }
              const strMatch = trimmed.match(/"([^"]+)"|'([^']+)'/);
              if (strMatch) {
                const spec = strMatch[1] || strMatch[2];
                const match = spec.match(/^([a-zA-Z0-9_\-\.]+)(?:[=><~^!]+([a-zA-Z0-9_\-\.]+))?/);
                if (match && match[1].toLowerCase() !== "python") {
                  const pkgName = match[1];
                  const rawVer = match[2];
                  const fullSpec = spec.slice(pkgName.length).trim() || rawVer || "*";
                  const locked = await resolver.resolvePython(manifestPath, pkgName);

                  if (locked) {
                    dependencies.push({
                      id: `pypi:${relManifest}:${pkgName}`,
                      name: pkgName,
                      currentVersion: locked.version,
                      requestedRange: fullSpec,
                      isLockfileResolved: true,
                      isRangeOnly: false,
                      ecosystem: "pypi",
                      language: "Python",
                      manifestFile: `${relManifest} (${locked.lockfileLabel})`
                    });
                  } else {
                    const isRange = isVersionRange(fullSpec);
                    const clean = cleanVersion(fullSpec);
                    dependencies.push({
                      id: `pypi:${relManifest}:${pkgName}`,
                      name: pkgName,
                      currentVersion: clean,
                      requestedRange: fullSpec,
                      isLockfileResolved: false,
                      isRangeOnly: isRange,
                      ecosystem: "pypi",
                      language: "Python",
                      manifestFile: relManifest
                    });
                  }
                }
              }
            } else if (inPoetrySection) {
              const simpleMatch = trimmed.match(/^([a-zA-Z0-9_\-\.]+)\s*=\s*"([^"]+)"/);
              const tableMatch = trimmed.match(/^([a-zA-Z0-9_\-\.]+)\s*=\s*\{.*version\s*=\s*"([^"]+)".*\}/);
              const name = (simpleMatch || tableMatch)?.[1];
              const ver = (simpleMatch || tableMatch)?.[2];
              if (name && name.toLowerCase() !== "python") {
                const locked = await resolver.resolvePython(manifestPath, name);
                const fullSpec = ver || "*";

                if (locked) {
                  dependencies.push({
                    id: `pypi:${relManifest}:${name}`,
                    name,
                    currentVersion: locked.version,
                    requestedRange: fullSpec,
                    isLockfileResolved: true,
                    isRangeOnly: false,
                    ecosystem: "pypi",
                    language: "Python",
                    manifestFile: `${relManifest} (${locked.lockfileLabel})`
                  });
                } else {
                  const isRange = isVersionRange(fullSpec);
                  const clean = cleanVersion(fullSpec);
                  dependencies.push({
                    id: `pypi:${relManifest}:${name}`,
                    name,
                    currentVersion: clean,
                    requestedRange: fullSpec,
                    isLockfileResolved: false,
                    isRangeOnly: isRange,
                    ecosystem: "pypi",
                    language: "Python",
                    manifestFile: relManifest
                  });
                }
              }
            }
          }
        } catch {
          // ignore
        }
      }

      // 4. Python: Pipfile
      else if (baseName === "Pipfile") {
        try {
          const raw = await fs.readFile(manifestPath, "utf-8");
          const lines = raw.split("\n");
          let inPackages = false;

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === "[packages]" || trimmed === "[dev-packages]") {
              inPackages = true;
              continue;
            } else if (trimmed.startsWith("[") && inPackages) {
              inPackages = false;
              continue;
            }

            if (inPackages && trimmed && !trimmed.startsWith("#")) {
              const match = trimmed.match(/^([a-zA-Z0-9_\-\.]+)\s*=\s*"([^"]+)"/);
              if (match) {
                const name = match[1];
                const ver = match[2];
                const locked = await resolver.resolvePython(manifestPath, name);
                const fullSpec = ver || "*";

                if (locked) {
                  dependencies.push({
                    id: `pypi:${relManifest}:${name}`,
                    name,
                    currentVersion: locked.version,
                    requestedRange: fullSpec,
                    isLockfileResolved: true,
                    isRangeOnly: false,
                    ecosystem: "pypi",
                    language: "Python",
                    manifestFile: `${relManifest} (${locked.lockfileLabel})`
                  });
                } else {
                  const isRange = isVersionRange(fullSpec);
                  const clean = cleanVersion(fullSpec);
                  dependencies.push({
                    id: `pypi:${relManifest}:${name}`,
                    name,
                    currentVersion: clean,
                    requestedRange: fullSpec,
                    isLockfileResolved: false,
                    isRangeOnly: isRange,
                    ecosystem: "pypi",
                    language: "Python",
                    manifestFile: relManifest
                  });
                }
              }
            }
          }
        } catch {
          // ignore
        }
      }

      // 5. Rust: Cargo.toml
      else if (baseName === "Cargo.toml") {
        try {
          const raw = await fs.readFile(manifestPath, "utf-8");
          const lines = raw.split("\n");
          let inDepsSection = false;

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("[dependencies]") || trimmed.startsWith("[dev-dependencies]")) {
              inDepsSection = true;
              continue;
            } else if (trimmed.startsWith("[") && inDepsSection) {
              inDepsSection = false;
              continue;
            }

            if (inDepsSection && trimmed && !trimmed.startsWith("#")) {
              const simpleMatch = trimmed.match(/^([a-zA-Z0-9_\-]+)\s*=\s*"([^"]+)"/);
              const tableMatch = trimmed.match(/^([a-zA-Z0-9_\-]+)\s*=\s*\{.*version\s*=\s*"([^"]+)".*\}/);
              const name = (simpleMatch || tableMatch)?.[1];
              const rawVer = (simpleMatch || tableMatch)?.[2];

              if (name && rawVer) {
                const locked = await resolver.resolveCargo(manifestPath, name);
                if (locked) {
                  dependencies.push({
                    id: `cargo:${relManifest}:${name}`,
                    name,
                    currentVersion: locked.version,
                    requestedRange: rawVer,
                    isLockfileResolved: true,
                    isRangeOnly: false,
                    ecosystem: "cargo",
                    language: "Rust",
                    manifestFile: `${relManifest} (${locked.lockfileLabel})`
                  });
                } else {
                  const isRange = isVersionRange(rawVer);
                  const clean = cleanVersion(rawVer);
                  dependencies.push({
                    id: `cargo:${relManifest}:${name}`,
                    name,
                    currentVersion: clean,
                    requestedRange: rawVer,
                    isLockfileResolved: false,
                    isRangeOnly: isRange,
                    ecosystem: "cargo",
                    language: "Rust",
                    manifestFile: relManifest
                  });
                }
              }
            }
          }
        } catch {
          // ignore
        }
      }

      // 6. Go: go.mod
      else if (baseName === "go.mod") {
        try {
          const raw = await fs.readFile(manifestPath, "utf-8");
          const lines = raw.split("\n");
          let inRequireBlock = false;

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === "require (") {
              inRequireBlock = true;
              continue;
            } else if (trimmed === ")" && inRequireBlock) {
              inRequireBlock = false;
              continue;
            }

            if (inRequireBlock || trimmed.startsWith("require ")) {
              const cleanLine = trimmed.replace(/^require\s+/, "");
              const parts = cleanLine.split(/\s+/);
              if (parts.length >= 2 && !cleanLine.startsWith("//")) {
                const name = parts[0];
                const rawVer = parts[1];
                const cleanVer = rawVer.replace(/^v/, "");

                dependencies.push({
                  id: `go:${relManifest}:${name}`,
                  name,
                  currentVersion: cleanVer,
                  requestedRange: rawVer,
                  isLockfileResolved: true,
                  isRangeOnly: false,
                  ecosystem: "go",
                  language: "Go",
                  manifestFile: relManifest
                });
              }
            }
          }
        } catch {
          // ignore
        }
      }

      // 7. PHP: composer.json
      else if (baseName === "composer.json") {
        try {
          const raw = await fs.readFile(manifestPath, "utf-8");
          const parsed = JSON.parse(raw);
          const reqs = { ...(parsed.require || {}), ...(parsed["require-dev"] || {}) };

          for (const [name, ver] of Object.entries(reqs)) {
            if (name === "php") continue;
            const rawVer = typeof ver === "string" ? ver : "unknown";
            const locked = await resolver.resolveComposer(manifestPath, name);

            if (locked) {
              dependencies.push({
                id: `composer:${relManifest}:${name}`,
                name,
                currentVersion: locked.version,
                requestedRange: rawVer,
                isLockfileResolved: true,
                isRangeOnly: false,
                ecosystem: "composer",
                language: "PHP",
                manifestFile: `${relManifest} (${locked.lockfileLabel})`
              });
            } else {
              const isRange = isVersionRange(rawVer);
              const clean = cleanVersion(rawVer);
              dependencies.push({
                id: `composer:${relManifest}:${name}`,
                name,
                currentVersion: clean,
                requestedRange: rawVer,
                isLockfileResolved: false,
                isRangeOnly: isRange,
                ecosystem: "composer",
                language: "PHP",
                manifestFile: relManifest
              });
            }
          }
        } catch {
          // ignore
        }
      }

      // 8. Ruby: Gemfile
      else if (baseName === "Gemfile") {
        try {
          const raw = await fs.readFile(manifestPath, "utf-8");
          const lines = raw.split("\n");

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;

            const gemMatch = trimmed.match(/^gem\s+['"]([^'"]+)['"](?:\s*,\s*['"]([^'"]+)['"])?/);
            if (gemMatch) {
              const name = gemMatch[1];
              const rawVer = gemMatch[2] ? gemMatch[2].trim() : "latest";
              const locked = await resolver.resolveGemfile(manifestPath, name);

              if (locked) {
                dependencies.push({
                  id: `rubygems:${relManifest}:${name}`,
                  name,
                  currentVersion: locked.version,
                  requestedRange: rawVer,
                  isLockfileResolved: true,
                  isRangeOnly: false,
                  ecosystem: "rubygems",
                  language: "Ruby",
                  manifestFile: `${relManifest} (${locked.lockfileLabel})`
                });
              } else {
                const isRange = isVersionRange(rawVer);
                const clean = cleanVersion(rawVer);
                dependencies.push({
                  id: `rubygems:${relManifest}:${name}`,
                  name,
                  currentVersion: clean,
                  requestedRange: rawVer,
                  isLockfileResolved: false,
                  isRangeOnly: isRange,
                  ecosystem: "rubygems",
                  language: "Ruby",
                  manifestFile: relManifest
                });
              }
            }
          }
        } catch {
          // ignore
        }
      }
    }

    return dependencies;
  }
}
