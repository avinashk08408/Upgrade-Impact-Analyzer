import type { BreakingChange, ConsumerUsage, RemediationPlan, EvidenceSource } from "../types.js";
export interface IntelRecord {
    upstreamRationale: string;
    runtimeRisk: string;
    remediation: RemediationPlan;
    evidence: EvidenceSource[];
}
export declare class RationaleProvider {
    /**
     * Generates deep architectural context explaining why upstream made the change,
     * what runtime hazard occurs if left unfixed, why the remediation works,
     * and verifiable documentation / diff evidence.
     */
    provideContext(packageName: string, change: BreakingChange, usage: ConsumerUsage): IntelRecord;
}
//# sourceMappingURL=rationaleProvider.d.ts.map