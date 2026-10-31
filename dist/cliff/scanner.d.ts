import { type CliffRule } from "./rules.js";
export type CliffConfidence = "CONFIRMED_FREE_CONFIG" | "CONDITIONAL_ON_FREE_TIER";
export interface CliffFinding {
    rule: CliffRule;
    confidence: CliffConfidence;
    confidenceLabel: string;
    isConfirmed: boolean;
    matchedEvidence: {
        file: string;
        matchedPattern: string;
        details: string;
    };
}
export interface CliffScanSummary {
    projectPath: string;
    filesScanned: string[];
    findingsCount: number;
    findings: CliffFinding[];
    timestamp: string;
}
/**
 * Sanitizes any raw string to guarantee secrets, credentials, or authentication tokens are never exposed.
 */
export declare function sanitizeSecretValues(input: string): string;
export declare class CliffScanner {
    private projectRoot;
    private rules;
    constructor(projectRoot?: string, rules?: CliffRule[]);
    /**
     * Recursively discovers candidate configuration, manifest, and environment files in projectRoot and subfolders.
     * Skips node_modules, build output, version control, and temporary cache directories.
     */
    private findFilesRecursively;
    scan(): Promise<CliffScanSummary>;
}
//# sourceMappingURL=scanner.d.ts.map