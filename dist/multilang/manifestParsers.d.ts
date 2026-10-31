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
export declare function isVersionRange(raw: string | undefined): boolean;
export declare function cleanVersion(raw: string | undefined): string;
export declare function loadNpmLockfileVersions(filePath: string): Promise<Map<string, string>>;
export declare function loadPnpmLockfileVersions(filePath: string): Promise<Map<string, string>>;
export declare function loadYarnLockfileVersions(filePath: string): Promise<Map<string, string>>;
export declare function loadCargoLockfileVersions(filePath: string): Promise<Map<string, string>>;
export declare function loadComposerLockfileVersions(filePath: string): Promise<Map<string, string>>;
export declare function loadPoetryLockfileVersions(filePath: string): Promise<Map<string, string>>;
export declare function loadPipfileLockVersions(filePath: string): Promise<Map<string, string>>;
export declare function loadGemfileLockVersions(filePath: string): Promise<Map<string, string>>;
export declare function readNodeModulesVersion(manifestDir: string, projectRoot: string, pkgName: string): Promise<string | null>;
export declare class HierarchicalLockfileResolver {
    private projectRoot;
    private jsonCache;
    private textCache;
    constructor(projectRoot: string);
    private loadJson;
    private loadText;
    /**
     * Resolves exact npm locked version for a specific manifest.
     * Traverses only from manifestDir upwards to projectRoot, preventing sibling workspace contamination.
     */
    resolveNpm(manifestPath: string, pkgName: string): Promise<{
        version: string;
        lockfileLabel: string;
    } | null>;
    private matchPnpmVersion;
    private matchYarnVersion;
    /**
     * Resolves exact Python locked version (poetry.lock, Pipfile.lock) for a specific manifest.
     */
    resolvePython(manifestPath: string, pkgName: string): Promise<{
        version: string;
        lockfileLabel: string;
    } | null>;
    /**
     * Resolves exact Rust locked version (Cargo.lock) for a specific manifest.
     */
    resolveCargo(manifestPath: string, pkgName: string): Promise<{
        version: string;
        lockfileLabel: string;
    } | null>;
    /**
     * Resolves exact PHP locked version (composer.lock) for a specific manifest.
     */
    resolveComposer(manifestPath: string, pkgName: string): Promise<{
        version: string;
        lockfileLabel: string;
    } | null>;
    /**
     * Resolves exact Ruby locked version (Gemfile.lock) for a specific manifest.
     */
    resolveGemfile(manifestPath: string, gemName: string): Promise<{
        version: string;
        lockfileLabel: string;
    } | null>;
}
export declare class ManifestParser {
    /**
     * Scans project directory recursively across Python, Rust, Go, PHP, Ruby, and JavaScript/TypeScript.
     * Lockfile resolution is workspace-scoped and hierarchical, ensuring monorepos never inherit sibling versions.
     */
    static discoverAllDependencies(projectRoot: string): Promise<DiscoveredDependency[]>;
}
//# sourceMappingURL=manifestParsers.d.ts.map