import type { ImpactReportItem } from "../types.js";
export declare class RiskCalculator {
    /**
     * Computes a normalized risk index from 0 (Safe) to 100 (Extremely Dangerous).
     */
    static calculateRisk(items: ImpactReportItem[]): number;
    static getRiskTier(score: number): "MINIMAL" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}
//# sourceMappingURL=riskScore.d.ts.map