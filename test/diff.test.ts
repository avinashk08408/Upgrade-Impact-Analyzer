import { describe, it, expect } from "vitest";
import { DeclarationLoader } from "../src/diff/declarationLoader.js";
import { TypeDiffEngine } from "../src/diff/typeDiffEngine.js";

describe("TypeDiffEngine", () => {
  it("should detect removed exports, parameter changes, and deprecations", () => {
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
    const changes = diffEngine.diff(oldSymbols, newSymbols);

    // 1. legacyAuth was removed
    const removedChange = changes.find((c) => c.symbolName === "legacyAuth");
    expect(removedChange).toBeDefined();
    expect(removedChange?.category).toBe("REMOVED_EXPORT");
    expect(removedChange?.severity).toBe("CRITICAL");

    // 2. fetchData had a required parameter added
    const paramChange = changes.find((c) => c.symbolName === "fetchData");
    expect(paramChange).toBeDefined();
    expect(paramChange?.category).toBe("PARAM_ADDED_REQUIRED");
    expect(paramChange?.severity).toBe("CRITICAL");

    // 3. helper was deprecated
    const depChange = changes.find((c) => c.symbolName === "helper");
    expect(depChange).toBeDefined();
    expect(depChange?.category).toBe("DEPRECATED_MEMBER");
    expect(depChange?.severity).toBe("WARNING");

    // 4. calculate is identical, should not be in changes
    const calcChange = changes.find((c) => c.symbolName === "calculate");
    expect(calcChange).toBeUndefined();
  });
});

