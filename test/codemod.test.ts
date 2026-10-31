import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { CodemodEngine } from "../src/cli/codemod.js";
import type { ImpactReportItem } from "../src/types.js";

describe("CodemodEngine", () => {
  let tempDir: string;
  let tempFilePath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "codemod-test-"));
    tempFilePath = path.join(tempDir, "service.ts");
    const initialCode = `
import { post } from "axios";

export function send() {
  return post("/api/data", { key: "value" });
}
`;
    await fs.writeFile(tempFilePath, initialCode.trim(), "utf-8");
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it("should apply automated remediation to consumer code and create backup", async () => {
    const codemod = new CodemodEngine(tempDir);

    const mockItem: ImpactReportItem = {
      usage: {
        filePath: "service.ts",
        line: 4,
        column: 10,
        identifierName: "post",
        sourceSnippet: 'return post("/api/data", { key: "value" });',
        isCallExpression: true,
        argumentCount: 2
      },
      breakingChange: {
        category: "PARAM_ADDED_REQUIRED",
        symbolName: "post",
        severity: "CRITICAL",
        description: "Requires third options parameter"
      },
      upstreamRationale: "Standardized request config block",
      runtimeRisk: "Undefined options object error",
      remediation: {
        beforeCode: 'return post("/api/data", { key: "value" });',
        afterCode: 'return post("/api/data", { key: "value" }, {});',
        explanation: "Pass empty configuration object",
        isAutoFixable: true
      }
    };

    const results = await codemod.applyFixes([mockItem]);

    expect(results.length).toBe(1);
    expect(results[0].success).toBe(true);

    const updatedContent = await fs.readFile(tempFilePath, "utf-8");
    expect(updatedContent).toContain('return post("/api/data", { key: "value" }, {});');

    // Verify backup exists
    const backupContent = await fs.readFile(`${tempFilePath}.breakcheck.bak`, "utf-8");
    expect(backupContent).toContain('return post("/api/data", { key: "value" });');

    // Test undo / revert
    const revertResult = await codemod.revertFix("service.ts");
    expect(revertResult.success).toBe(true);

    const restoredContent = await fs.readFile(tempFilePath, "utf-8");
    expect(restoredContent).toContain('return post("/api/data", { key: "value" });');
  });

  it("should reject path traversal outside the project directory", async () => {
    const codemod = new CodemodEngine(tempDir);

    const mockItem: ImpactReportItem = {
      usage: {
        filePath: "../outside.ts",
        line: 1,
        column: 1,
        identifierName: "post",
        sourceSnippet: "post()",
        isCallExpression: true
      },
      breakingChange: {
        category: "PARAM_ADDED_REQUIRED",
        symbolName: "post",
        severity: "CRITICAL",
        description: "Requires options"
      },
      upstreamRationale: "Rationale",
      runtimeRisk: "Risk",
      remediation: {
        beforeCode: "post()",
        afterCode: "post({})",
        explanation: "Fix",
        isAutoFixable: true
      }
    };

    const results = await codemod.applyFixes([mockItem]);
    expect(results.length).toBe(1);
    expect(results[0].success).toBe(false);
    expect(results[0].message).toContain("Security restriction");
  });
});
