import type { ImpactReportItem } from "../types.js";
export interface CodemodResult {
    filePath: string;
    line: number;
    success: boolean;
    message: string;
    backupPath?: string;
}
export declare class CodemodEngine {
    private projectRoot;
    constructor(projectRoot?: string);
    /**
     * Securely validates that a path resolves strictly inside projectRoot,
     * resolving symlinks and rejecting path traversal (e.g. C:\repo-backup vs C:\repo).
     */
    validatePath(targetPath: string): Promise<string>;
    /**
     * Applies automated remediations to consumer files.
     * Only records success after the file has actually been modified and written to disk.
     */
    applyFixes(items: ImpactReportItem[]): Promise<CodemodResult[]>;
    /**
     * Reverts changes using the saved backup file.
     */
    revertFix(filePath: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
//# sourceMappingURL=codemod.d.ts.map