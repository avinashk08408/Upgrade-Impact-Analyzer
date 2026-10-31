import type { AnalysisSummary } from "../types.js";
import type { CodemodResult } from "./codemod.js";
export declare class Reporter {
    static printSummary(summary: AnalysisSummary): void;
    static printJson(summary: AnalysisSummary): void;
    static printMarkdown(summary: AnalysisSummary): void;
    static printCodemodSummary(results: CodemodResult[]): void;
}
//# sourceMappingURL=reporter.d.ts.map