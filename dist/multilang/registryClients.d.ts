import type { Ecosystem } from "./manifestParsers.js";
export interface PackageRegistryMetadata {
    latestVersion: string;
    releaseDate: string;
}
export declare class MultiLangRegistryClient {
    static clearCache(): void;
    static evict(name: string, ecosystem: Ecosystem): void;
    static getPackageMetadata(name: string, ecosystem: Ecosystem): Promise<PackageRegistryMetadata>;
    private static fetchNpmMetadata;
    private static fetchPyPiMetadata;
    private static fetchCargoMetadata;
    private static fetchGoMetadata;
    private static fetchComposerMetadata;
    private static fetchRubyGemsMetadata;
}
//# sourceMappingURL=registryClients.d.ts.map