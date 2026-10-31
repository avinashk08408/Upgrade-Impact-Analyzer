import type { ImpactReportItem } from "../types.js";

export class RiskCalculator {
  /**
   * Computes a normalized risk index from 0 (Safe) to 100 (Extremely Dangerous).
   */
  public static calculateRisk(items: ImpactReportItem[]): number {
    if (items.length === 0) {
      return 0;
    }

    let rawScore = 0;

    for (const item of items) {
      switch (item.breakingChange.severity) {
        case "CRITICAL":
          rawScore += 40;
          break;
        case "WARNING":
          rawScore += 15;
          break;
        case "INFO":
          rawScore += 5;
          break;
      }
    }

    return Math.min(100, rawScore);
  }

  public static getRiskTier(score: number): "MINIMAL" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
    if (score === 0) return "MINIMAL";
    if (score < 25) return "LOW";
    if (score < 55) return "MEDIUM";
    if (score < 80) return "HIGH";
    return "CRITICAL";
  }
}

