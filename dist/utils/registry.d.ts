export interface PackageDeclarationBundle {
    entryDtsContent: string;
    version: string;
}
/**
 * Validates that an extracted declaration path resolves strictly within baseDir,
 * blocking path traversal attacks (e.g. ../../) and symlink escapes outside the package.
 */
export declare function validateExtractedFilePath(baseDir: string, relativePath: string): Promise<string>;
export declare class RegistryFetcher {
    private cacheBaseDir;
    constructor();
    fetchPackageDeclarations(spec: string): Promise<PackageDeclarationBundle>;
}
//# sourceMappingURL=registry.d.ts.map