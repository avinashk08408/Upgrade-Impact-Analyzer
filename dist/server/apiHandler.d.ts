import type http from "node:http";
export declare function readBody(req: http.IncomingMessage, maxSizeBytes?: number): Promise<string>;
export declare function isAllowedOrigin(req: http.IncomingMessage): boolean;
export interface ParsedSemver {
    major: number;
    minor: number;
    patch: number;
    prerelease: Array<string | number>;
}
export declare function parseSemver(v: string | undefined): ParsedSemver | null;
export declare function compareSemver(aStr: string, bStr: string): -1 | 0 | 1 | null;
export declare function isVersionOutdated(current: string, latest: string): boolean | null;
export type UpgradeRangeRelation = "in_range" | "out_of_range" | "unknown";
/**
 * Determines whether a newer version from the registry fits within the manifest's declared range,
 * or requires manually updating the range (e.g. major version bump outside caret/tilde/pin).
 */
export declare function checkUpgradeRangeRelation(current: string, latest: string, requestedRange?: string): UpgradeRangeRelation;
export declare function handleApiRequest(req: http.IncomingMessage, res: http.ServerResponse, projectPath?: string): Promise<boolean>;
//# sourceMappingURL=apiHandler.d.ts.map