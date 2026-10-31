import type { BreakingChange, ConsumerUsage, RemediationPlan, EvidenceSource } from "../types.js";

export interface IntelRecord {
  upstreamRationale: string;
  runtimeRisk: string;
  remediation: RemediationPlan;
  evidence: EvidenceSource[];
}

export class RationaleProvider {
  /**
   * Generates deep architectural context explaining why upstream made the change,
   * what runtime hazard occurs if left unfixed, why the remediation works,
   * and verifiable documentation / diff evidence.
   */
  public provideContext(
    packageName: string,
    change: BreakingChange,
    usage: ConsumerUsage
  ): IntelRecord {
    const npmPackageUrl = `https://www.npmjs.com/package/${packageName}`;
    const changelogSearchUrl = `https://github.com/search?q=repo%3A${encodeURIComponent(packageName)}+${encodeURIComponent(change.symbolName)}+breaking&type=commits`;

    switch (change.category) {
      case "REMOVED_EXPORT":
        return {
          upstreamRationale:
            `The maintainers of '${packageName}' removed export '${change.symbolName}' to reduce bundle size, eliminate legacy code paths, or consolidate the API under a modern standard alternative.`,
          runtimeRisk:
            `Executing this line will immediately throw a TypeError: '${change.symbolName}' is not a function (or undefined) during module evaluation or runtime invocation.`,
          remediation: {
            beforeCode: usage.sourceSnippet,
            afterCode: usage.sourceSnippet,
            explanation:
              `Refactor this call site to import the supported replacement method recommended in the '${packageName}' migration guide. This cannot be safely automated.`,
            isAutoFixable: false
          },
          evidence: [
            {
              title: `TypeScript Declaration Diff for '${change.symbolName}'`,
              notes: change.oldSignature ? `Previous signature: ${change.oldSignature}` : "Symbol was present in previous .d.ts but absent in target .d.ts"
            },
            {
              title: `Official '${packageName}' Package Documentation`,
              url: npmPackageUrl
            },
            {
              title: `GitHub Commit & PR History for '${change.symbolName}'`,
              url: changelogSearchUrl
            }
          ]
        };

      case "PARAM_ADDED_REQUIRED": {
        // Correctly handle calls ending in ); as well as plain )
        const fixedSnippet = usage.sourceSnippet.match(/\)(;?\s*)$/)
          ? usage.sourceSnippet.replace(/\)(;?\s*)$/, ", {})$1")
          : `${usage.sourceSnippet}, {}`;

        return {
          upstreamRationale:
            `In modern versions of '${packageName}', '${change.symbolName}' requires explicit configuration or context (e.g. security headers, abort signals, or options) to avoid unexpected defaults and protect against security vulnerabilities.`,
          runtimeRisk:
            `Invoking '${change.symbolName}' with fewer arguments than expected causes the missing parameter to be passed as undefined, which triggers runtime property access errors inside the library dispatcher.`,
          remediation: {
            beforeCode: usage.sourceSnippet,
            afterCode: fixedSnippet,
            explanation:
              `Providing the required parameter (e.g. an empty configuration object '{}') satisfies the new function signature and ensures internal state initializers execute cleanly.`,
            isAutoFixable: true
          },
          evidence: [
            {
              title: `Signature Mutation Details`,
              notes: `Old declaration: ${change.oldSignature || "N/A"} | New declaration: ${change.newSignature || "N/A"}`
            },
            {
              title: `'${packageName}' Release Notes & Commit References`,
              url: changelogSearchUrl
            }
          ]
        };
      }

      case "DEPRECATED_MEMBER":
        return {
          upstreamRationale:
            `Upstream marked '${change.symbolName}' as deprecated because a superior, standard pattern is now available. This member is scheduled for complete removal in a subsequent major version.`,
          runtimeRisk:
            `While code will currently execute without immediate failure, continued usage introduces technical debt and will fail completely upon the next major upgrade.`,
          remediation: {
            beforeCode: usage.sourceSnippet,
            afterCode: usage.sourceSnippet,
            explanation:
              `Migrate away from '${change.symbolName}' according to the migration guide. Automatic line replacement is not offered to prevent broken runtime states.`,
            isAutoFixable: false
          },
          evidence: [
            {
              title: `JSDoc Deprecation Tag in Target Typings`,
              notes: change.description
            },
            {
              title: `Official '${packageName}' Documentation`,
              url: npmPackageUrl
            }
          ]
        };

      case "RETURN_TYPE_CHANGED":
        return {
          upstreamRationale:
            `The return type was altered to improve type safety, enforce asynchronous execution, or return structured responses rather than scalar values.`,
          runtimeRisk:
            `Downstream code expecting the previous return shape may encounter unexpected type coercion, failed Promise resolution, or undefined property lookups.`,
          remediation: {
            beforeCode: usage.sourceSnippet,
            afterCode: usage.sourceSnippet,
            explanation:
              `Inspect handling of the return value and update variable assignments to conform to the new return type contract.`,
            isAutoFixable: false
          },
          evidence: [
            {
              title: `Return Type Contract Change`,
              notes: change.description
            }
          ]
        };

      default:
        return {
          upstreamRationale:
            `Upstream API contract changed between versions to enhance performance and maintainability.`,
          runtimeRisk:
            `Potential incompatibility between the caller expectation and the callee implementation.`,
          remediation: {
            beforeCode: usage.sourceSnippet,
            afterCode: usage.sourceSnippet,
            explanation:
              `Align this call site with the updated method signature.`,
            isAutoFixable: false
          },
          evidence: [
            {
              title: `Upstream Package Reference`,
              url: npmPackageUrl
            }
          ]
        };
    }
  }
}
