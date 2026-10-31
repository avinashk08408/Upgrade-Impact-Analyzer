import { describe, it, expect } from "vitest";
import { ProjectScanner } from "../src/scanner/projectScanner.js";

describe("ProjectScanner", () => {
  it("should extract named imports and call-site line numbers accurately", () => {
    const scanner = new ProjectScanner();
    const sourceCode = `
import { fetchData, calculate } from "sample-lib";

export async function main() {
  const data = await fetchData("https://api.com");
  return data;
}
`;
    scanner.addSourceFileFromText("src/main.ts", sourceCode);

    const usages = scanner.scanForPackageUsage("sample-lib");

    expect(usages.length).toBe(1);
    expect(usages[0].identifierName).toBe("fetchData");
    expect(usages[0].line).toBe(5);
    expect(usages[0].isCallExpression).toBe(true);
    expect(usages[0].argumentCount).toBe(1);
  });

  it("should extract property access on default imports", () => {
    const scanner = new ProjectScanner();
    const sourceCode = `
import axios from "axios";

export function getProfile() {
  return axios.post("/profile", { name: "test" });
}
`;
    scanner.addSourceFileFromText("src/api.ts", sourceCode);

    const usages = scanner.scanForPackageUsage("axios");

    expect(usages.length).toBe(1);
    expect(usages[0].identifierName).toBe("post");
    expect(usages[0].isCallExpression).toBe(true);
    expect(usages[0].argumentCount).toBe(2);
  });

  it("should extract CommonJS require calls and destructured imports", () => {
    const scanner = new ProjectScanner();
    const sourceCode = `
const { get, post } = require("axios");
const lodash = require("lodash");

export function run() {
  get("/users");
  return lodash.map([1, 2], (x) => x * 2);
}
`;
    scanner.addSourceFileFromText("src/cjs.js", sourceCode);

    const axiosUsages = scanner.scanForPackageUsage("axios");
    const lodashUsages = scanner.scanForPackageUsage("lodash");

    expect(axiosUsages.length).toBe(1);
    expect(axiosUsages[0].identifierName).toBe("get");
    expect(axiosUsages[0].isCallExpression).toBe(true);

    expect(lodashUsages.length).toBe(1);
    expect(lodashUsages[0].identifierName).toBe("map");
    expect(lodashUsages[0].isCallExpression).toBe(true);
  });

  it("should handle references across multiple files without out-of-range errors", () => {
    const scanner = new ProjectScanner();

    // Short exporter file (approx 50 chars)
    const exporterCode = `import { Command } from "commander";
export { Command };
`;
    scanner.addSourceFileFromText("src/exporter.ts", exporterCode);

    // Longer consumer file where call site position is well beyond exporterCode length
    const consumerCode = `import { Command } from "./exporter";

// Some comments and spacing to ensure character offset is large
// Line 4
// Line 5
export function runCli() {
  const program = new Command();
  return program;
}
`;
    scanner.addSourceFileFromText("src/consumer.ts", consumerCode);

    let usages: any[] = [];
    expect(() => {
      usages = scanner.scanForPackageUsage("commander");
    }).not.toThrow();

    expect(usages.length).toBeGreaterThanOrEqual(1);
    const consumerUsage = usages.find((u) => u.filePath.endsWith("consumer.ts"));
    expect(consumerUsage).toBeDefined();
    expect(consumerUsage.line).toBe(7);
    expect(consumerUsage.sourceSnippet).toBe("const program = new Command();");
    expect(consumerUsage.identifierName).toBe("Command");
  });

  it("should handle default import references across multiple files", () => {
    const scanner = new ProjectScanner();

    const exporterCode = `import axios from "axios";
export default axios;
`;
    scanner.addSourceFileFromText("src/apiExporter.ts", exporterCode);

    const consumerCode = `import myApi from "./apiExporter";

// Line 3
// Line 4
export function request() {
  return myApi.get("/health");
}
`;
    scanner.addSourceFileFromText("src/apiConsumer.ts", consumerCode);

    let usages: any[] = [];
    expect(() => {
      usages = scanner.scanForPackageUsage("axios");
    }).not.toThrow();

    expect(usages.length).toBeGreaterThanOrEqual(1);
    const consumerUsage = usages.find((u) => u.filePath.endsWith("apiConsumer.ts"));
    expect(consumerUsage).toBeDefined();
    expect(consumerUsage.line).toBe(6);
    expect(consumerUsage.identifierName).toBe("get");
    expect(consumerUsage.sourceSnippet).toBe('return myApi.get("/health");');
  });
});

