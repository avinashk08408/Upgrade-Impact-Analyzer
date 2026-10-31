import { type SourceFile } from "ts-morph";
import type { ConsumerUsage } from "../types.js";
export declare class ProjectScanner {
    private project;
    constructor(tsConfigPath?: string);
    addSourceFilesFromPattern(pattern: string): void;
    addSourceFileFromText(filePath: string, content: string): SourceFile;
    scanForPackageUsage(packageName: string): ConsumerUsage[];
    private collectIdentifierReferences;
    private collectDefaultOrNamespaceReferences;
}
//# sourceMappingURL=projectScanner.d.ts.map