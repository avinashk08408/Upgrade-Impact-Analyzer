import { describe, it, expect } from "vitest";
import { ProjectScanner } from "../src/scanner/projectScanner.js";
import { DeclarationLoader } from "../src/diff/declarationLoader.js";
import { TypeDiffEngine } from "../src/diff/typeDiffEngine.js";
import { ImpactCorrelator } from "../src/engine/impactCorrelator.js";

describe("ImpactCorrelator (Core User Journey)", () => {
  it("should only report breaking changes that intersect with code the user actually writes", () => {
    const consumerCode = `
import { fetchData, calculate, helper } from "sample-lib";

export async function run() {
  const result = await fetchData("https://api.example.com/items");
  const score = calculate(5, 10);
  helper();
  return { result, score };
}
`;
    const scanner = new ProjectScanner();
    scanner.addSourceFileFromText("src/index.ts", consumerCode);
    const usages = scanner.scanForPackageUsage("sample-lib");

    const oldDts = `
export declare function fetchData(url: string): Promise<string>;
export declare function calculate(a: number, b: number): number;
export declare function legacyAuth(): void;
export declare function helper(): void;
`;

    const newDts = `
export declare function fetchData(url: string, options: { timeout: number }): Promise<string>;
export declare function calculate(a: number, b: number): number;
/**
 * @deprecated Use newHelper instead.
 */
export declare function helper(): void;
export declare function newFeature(): void;
`;

    const loader = new DeclarationLoader();
    const oldSymbols = loader.parseDeclarations(oldDts, "old.d.ts");
    const newSymbols = loader.parseDeclarations(newDts, "new.d.ts");

    const diffEngine = new TypeDiffEngine();
    const breakingChanges = diffEngine.diff(oldSymbols, newSymbols);

    const correlator = new ImpactCorrelator();
    const summary = correlator.correlate(
      "sample-lib",
      "1.0.0",
      "2.0.0",
      usages,
      breakingChanges
    );

    // Upstream has 3 breaking/warning changes: legacyAuth (removed), fetchData (param added), helper (deprecated)
    expect(summary.totalUpstreamChanges).toBe(3);

    // But consumer only uses fetchData and helper. legacyAuth is completely excluded!
    expect(summary.affectedUsagesCount).toBe(2);

    const affectedSymbols = summary.items.map((i) => i.usage.identifierName);
    expect(affectedSymbols).toContain("fetchData");
    expect(affectedSymbols).toContain("helper");
    expect(affectedSymbols).not.toContain("legacyAuth");

    const fetchDataItem = summary.items.find((i) => i.usage.identifierName === "fetchData");
    expect(fetchDataItem).toBeDefined();
    expect(fetchDataItem?.upstreamRationale).toContain("explicit configuration");
    expect(fetchDataItem?.remediation.explanation).toBeDefined();
    expect(fetchDataItem?.usage.line).toBe(5);
  });

  it("should not flag PARAM_ADDED_REQUIRED if caller already passes enough arguments", () => {
    // Caller passes 2 arguments
    const consumerCode = `
import { fetchData } from "sample-lib";

export async function run() {
  const result = await fetchData("https://api.example.com/items", { timeout: 5000 });
  return result;
}
`;
    const scanner = new ProjectScanner();
    scanner.addSourceFileFromText("src/index.ts", consumerCode);
    const usages = scanner.scanForPackageUsage("sample-lib");

    const oldDts = `export declare function fetchData(url: string): Promise<string>;`;
    const newDts = `export declare function fetchData(url: string, options: { timeout: number }): Promise<string>;`;

    const loader = new DeclarationLoader();
    const oldSymbols = loader.parseDeclarations(oldDts, "old.d.ts");
    const newSymbols = loader.parseDeclarations(newDts, "new.d.ts");

    const diffEngine = new TypeDiffEngine();
    const breakingChanges = diffEngine.diff(oldSymbols, newSymbols);

    const correlator = new ImpactCorrelator();
    const summary = correlator.correlate("sample-lib", "1.0.0", "2.0.0", usages, breakingChanges);

    // Caller already passed 2 arguments, so it does not affect them!
    expect(summary.affectedUsagesCount).toBe(0);
    expect(summary.items.length).toBe(0);
  });
});
