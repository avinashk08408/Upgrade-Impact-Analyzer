import type { ConsumerUsage, BreakingChange, ImpactReportItem, AnalysisSummary } from "../types.js";
import { RationaleProvider } from "../intel/rationaleProvider.js";
import { RiskCalculator } from "./riskScore.js";

export class ImpactCorrelator {
  private rationaleProvider: RationaleProvider;

  constructor() {
    this.rationaleProvider = new RationaleProvider();
  }

  public correlate(
    packageName: string,
    currentVersion: string,
    targetVersion: string,
    usages: ConsumerUsage[],
    breakingChanges: BreakingChange[]
  ): AnalysisSummary {
    const items: ImpactReportItem[] = [];

    // Map breaking changes by symbol name for fast lookup
    const changesBySymbol = new Map<string, BreakingChange[]>();
    for (const change of breakingChanges) {
      const existing = changesBySymbol.get(change.symbolName) ?? [];
      existing.push(change);
      changesBySymbol.set(change.symbolName, existing);
    }

    for (const usage of usages) {
      const matchedChanges = changesBySymbol.get(usage.identifierName);

      if (matchedChanges && matchedChanges.length > 0) {
        for (const change of matchedChanges) {
          // Verify if caller already supplies enough arguments
          if (change.category === "PARAM_ADDED_REQUIRED" && usage.argumentCount !== undefined) {
            const match = change.description.match(/now requires (\d+) arguments/);
            if (match) {
              const requiredArgs = parseInt(match[1], 10);
              if (usage.argumentCount >= requiredArgs) {
                // Caller already supplies sufficient arguments; skip reporting as breaking change
                continue;
              }
            }
          }

          const intel = this.rationaleProvider.provideContext(packageName, change, usage);

          items.push({
            usage,
            breakingChange: change,
            upstreamRationale: intel.upstreamRationale,
            runtimeRisk: intel.runtimeRisk,
            remediation: intel.remediation,
            evidence: intel.evidence
          });
        }
      }
    }

    const riskScore = RiskCalculator.calculateRisk(items);
    const uniqueFiles = new Set(usages.map((u) => u.filePath));

    return {
      packageName,
      currentVersion,
      targetVersion,
      totalUpstreamChanges: breakingChanges.length,
      affectedUsagesCount: items.length,
      riskScore,
      items,
      scanScope: {
        checkedVersions: {
          base: currentVersion,
          target: targetVersion
        },
        inspectedFileCount: uniqueFiles.size,
        uninspectedPatterns: [
          "Dynamic module imports (e.g. import(variableName))",
          "Computed property access (e.g. client[dynamicKey]())",
          "Runtime monkey-patching and polyfills outside .d.ts contracts"
        ],
        disclaimer:
          "Analysis is based on static AST traversal of explicit imports against package declaration rollups. Dynamic invocations and unexported internal symbols cannot be statically verified."
      }
    };
  }
}
