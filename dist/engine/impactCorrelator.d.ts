import type { ConsumerUsage, BreakingChange, AnalysisSummary } from "../types.js";
export declare class ImpactCorrelator {
    private rationaleProvider;
    constructor();
    correlate(packageName: string, currentVersion: string, targetVersion: string, usages: ConsumerUsage[], breakingChanges: BreakingChange[]): AnalysisSummary;
}
//# sourceMappingURL=impactCorrelator.d.ts.map