import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import pacote from "pacote";
/**
 * Validates that an extracted declaration path resolves strictly within baseDir,
 * blocking path traversal attacks (e.g. ../../) and symlink escapes outside the package.
 */
export async function validateExtractedFilePath(baseDir, relativePath) {
    if (typeof relativePath !== "string" || !relativePath.trim()) {
        throw new Error("Invalid declaration path specified in package manifest.");
    }
    const realBaseDir = await fs.realpath(baseDir);
    const resolvedTarget = path.resolve(realBaseDir, relativePath);
    // Check lexical containment against baseDir
    const rel = path.relative(realBaseDir, resolvedTarget);
    if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
        throw new Error(`Security validation failed: Declaration path '${relativePath}' attempts directory traversal outside package directory.`);
    }
    // Check if file exists and canonicalize symlinks
    let realTarget;
    try {
        realTarget = await fs.realpath(resolvedTarget);
    }
    catch (err) {
        throw new Error(`Declaration file not found at '${relativePath}': ${err.message}`);
    }
    const realRel = path.relative(realBaseDir, realTarget);
    if (realRel === ".." || realRel.startsWith(`..${path.sep}`) || path.isAbsolute(realRel)) {
        throw new Error(`Security validation failed: Declaration file '${relativePath}' resolves via symlink outside package directory.`);
    }
    return realTarget;
}
export class RegistryFetcher {
    cacheBaseDir;
    constructor() {
        this.cacheBaseDir = path.join(os.tmpdir(), "breakcheck-cache");
    }
    async fetchPackageDeclarations(spec) {
        let manifest;
        try {
            manifest = await pacote.manifest(spec);
        }
        catch (err) {
            throw new Error(`Failed to find package '${spec}' on npm registry: ${err?.message || "Package not found"}`);
        }
        const version = manifest.version;
        const pkgName = manifest.name;
        const sanitizedPkgName = pkgName.replace(/[\/@]/g, "_");
        const targetDir = path.join(this.cacheBaseDir, `${sanitizedPkgName}_${version}`);
        await fs.mkdir(targetDir, { recursive: true });
        // Extract tarball to temp directory
        await pacote.extract(spec, targetDir);
        const pkgJsonPath = path.join(targetDir, "package.json");
        const pkgJsonRaw = await fs.readFile(pkgJsonPath, "utf-8");
        const pkgJson = JSON.parse(pkgJsonRaw);
        const dtsRelPath = pkgJson.types ||
            pkgJson.typings ||
            (pkgJson.exports?.["."]?.types) ||
            "index.d.ts";
        let dtsFullPath = "";
        try {
            dtsFullPath = await validateExtractedFilePath(targetDir, dtsRelPath);
        }
        catch (err) {
            if (err.message && err.message.includes("Security validation failed")) {
                throw err;
            }
            dtsFullPath = "";
        }
        if (dtsFullPath) {
            try {
                const entryDtsContent = await fs.readFile(dtsFullPath, "utf-8");
                return {
                    entryDtsContent,
                    version
                };
            }
            catch {
                // Continue to fallback search
            }
        }
        // 1. Try finding any .d.ts in the extracted package
        try {
            const files = await fs.readdir(targetDir);
            const fallbackDts = files.find((f) => f.endsWith(".d.ts"));
            if (fallbackDts) {
                const secureFallbackPath = await validateExtractedFilePath(targetDir, fallbackDts);
                const content = await fs.readFile(secureFallbackPath, "utf-8");
                return {
                    entryDtsContent: content,
                    version
                };
            }
        }
        catch (err) {
            if (err.message && err.message.includes("Security validation failed")) {
                throw err;
            }
            // Continue to @types fallback
        }
        // 2. Try fetching DefinitelyTyped (@types/<pkg>) for libraries like lodash or express
        const typesPkgName = pkgName.startsWith("@")
            ? `@types/${pkgName.slice(1).replace("/", "__")}`
            : `@types/${pkgName}`;
        try {
            const typesDir = path.join(this.cacheBaseDir, `${typesPkgName.replace(/[\/@]/g, "_")}_types`);
            await fs.mkdir(typesDir, { recursive: true });
            await pacote.extract(typesPkgName, typesDir);
            const typesPkgJsonRaw = await fs.readFile(path.join(typesDir, "package.json"), "utf-8");
            const typesPkgJson = JSON.parse(typesPkgJsonRaw);
            const typesDtsRel = typesPkgJson.types || typesPkgJson.typings || "index.d.ts";
            const secureTypesDtsPath = await validateExtractedFilePath(typesDir, typesDtsRel);
            const typesDtsContent = await fs.readFile(secureTypesDtsPath, "utf-8");
            return {
                entryDtsContent: typesDtsContent,
                version: manifest.version
            };
        }
        catch (err) {
            if (err.message && err.message.includes("Security validation failed")) {
                throw err;
            }
            throw new Error(`Package '${pkgName}@${version}' does not ship built-in TypeScript declarations (.d.ts), and no '${typesPkgName}' companion package was found on npm.`);
        }
    }
}
//# sourceMappingURL=registry.js.map