import { describe, it, expect } from "vitest";
import { renderTui } from "../src/tui/render.js";
import { TuiApp } from "../src/tui/app.js";
import type { TuiState, DependencyItem } from "../src/tui/types.js";
import type { CliffFinding } from "../cliff/scanner.js";

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

describe("BreakCheck TUI Engine", () => {
  const createBaseState = (): TuiState => ({
    projectPath: "c:/repo/my-service",
    projectName: "my-service",
    activeTab: "dependencies",
    viewMode: "list",
    selectedDepIndex: 0,
    selectedCliffIndex: 0,
    depScrollOffset: 0,
    cliffScrollOffset: 0,
    detailScrollOffset: 0,
    searchQuery: "",
    isSearching: false,
    dependencies: [],
    cliffFindings: [],
    analyses: {},
    isLoadingDeps: false,
    isLoadingCliffs: false
  });

  it("should render header with workspace name, path, and navigation tabs", () => {
    const state = createBaseState();
    const output = stripAnsi(renderTui(state, 100, 24));

    expect(output).toContain("BREAKCHECK");
    expect(output).toContain("my-service");
    expect(output).toContain("c:/repo/my-service");
    expect(output).toContain("[1] Dependency Upgrades");
    expect(output).toContain("[2] Free-Tier Operational Limits");
  });

  it("should display [CHECK FAILED] on network error and not look like up-to-date", () => {
    const state = createBaseState();
    state.dependencies = [
      {
        name: "requests",
        currentVersion: "2.31.0",
        isLockfileResolved: false,
        ecosystem: "pypi",
        language: "Python",
        manifestFile: "requirements.txt",
        latestVersion: "unknown",
        releaseDate: "Unknown",
        status: "error",
        errorMessage: "Network timeout connecting to PyPI"
      }
    ];

    const output = stripAnsi(renderTui(state, 120, 24));
    expect(output).toContain("[CHECK FAILED]");
    expect(output).not.toContain("[UP TO DATE]");
    expect(output).toContain("requests");
  });

  it("should render search bar and filter items in real-time", () => {
    const state = createBaseState();
    state.dependencies = [
      {
        name: "axios",
        currentVersion: "1.6.0",
        isLockfileResolved: true,
        ecosystem: "npm",
        language: "JavaScript",
        manifestFile: "package.json",
        latestVersion: "1.7.2",
        releaseDate: "May 2024",
        status: "upgrade_available"
      },
      {
        name: "flask",
        currentVersion: "3.0.0",
        isLockfileResolved: false,
        ecosystem: "pypi",
        language: "Python",
        manifestFile: "requirements.txt",
        latestVersion: "3.0.0",
        releaseDate: "Oct 2023",
        status: "up_to_date"
      }
    ];
    state.searchQuery = "ax";

    const output = stripAnsi(renderTui(state, 120, 24));
    expect(output).toContain("axios");
    expect(output).not.toContain("flask");
  });

  it("should distinguish verified npm AST diffs from multi-language call-site inventories", () => {
    // 1. Python package detail
    const state = createBaseState();
    state.viewMode = "detail";
    state.dependencies = [
      {
        name: "requests",
        currentVersion: "2.28.0",
        isLockfileResolved: false,
        ecosystem: "pypi",
        language: "Python",
        manifestFile: "requirements.txt",
        latestVersion: "2.31.0",
        releaseDate: "May 2023",
        status: "upgrade_available"
      }
    ];
    state.analyses["requests"] = {
      packageName: "requests",
      ecosystem: "pypi",
      targetVersion: "2.31.0",
      fromVersion: "2.28.0",
      loading: false,
      totalUpstreamChanges: 0,
      affectedUsagesCount: 1,
      isNonNpmAudit: true,
      items: [
        {
          usage: {
            filePath: "services/http.py",
            line: 12,
            column: 1,
            identifierName: "get",
            sourceSnippet: "response = requests.get(url)",
            isCallExpression: true
          },
          breakingChange: {
            category: "USAGE_AUDIT",
            symbolName: "get",
            severity: "INFO",
            description: "Active invocation found in services/http.py:12"
          },
          upstreamRationale: "Active reference to 'get' detected.",
          runtimeRisk: "Verify arguments before upgrading.",
          remediation: {
            beforeCode: "response = requests.get(url)",
            afterCode: "response = requests.get(url)",
            explanation: "Review changelog",
            isAutoFixable: false
          }
        }
      ]
    };

    const pyOutput = stripAnsi(renderTui(state, 120, 24));
    expect(pyOutput).toContain("PYPI Call-Site Usage Inventory");
    expect(pyOutput).toContain("CALL-SITE INVENTORY");
    expect(pyOutput).toContain("services/http.py:12");
    expect(pyOutput).not.toContain("TypeScript / JavaScript AST Type Declaration Diffing");
  });

  it("should never claim an upgrade is safe just because no usages were found", () => {
    const state = createBaseState();
    state.viewMode = "detail";
    state.dependencies = [
      {
        name: "tokio",
        currentVersion: "1.30.0",
        isLockfileResolved: true,
        ecosystem: "cargo",
        language: "Rust",
        manifestFile: "Cargo.toml",
        latestVersion: "1.35.0",
        releaseDate: "Dec 2023",
        status: "upgrade_available"
      }
    ];
    state.analyses["tokio"] = {
      packageName: "tokio",
      ecosystem: "cargo",
      targetVersion: "1.35.0",
      fromVersion: "1.30.0",
      loading: false,
      totalUpstreamChanges: 0,
      affectedUsagesCount: 0,
      isNonNpmAudit: true,
      items: []
    };

    const output = stripAnsi(renderTui(state, 120, 24));
    expect(output).toContain("NO EXPLICIT CALL SITES DETECTED IN SCANNED FILES");
    expect(output).toContain("Important: This does not guarantee the upgrade is safe");
    expect(output).not.toContain("Safe to upgrade");
  });

  it("should render free-tier cloud limits with provider, trigger, and alternative platforms", () => {
    const state = createBaseState();
    state.activeTab = "cliffs";
    state.viewMode = "detail";
    const sampleFinding: CliffFinding = {
      rule: {
        id: "render-15min-spindown",
        provider: "Render",
        service: "Web Service",
        plan: "Free Instance",
        triggerCondition: "15 minutes of zero inbound traffic",
        timeToFailure: "After 15 minutes",
        impactDescription: "Cold start penalty of 50+ seconds",
        applicabilityNote: "Applies only to free web services",
        detectionPatterns: {},
        recommendedFix: {
          summary: "Configure health monitor ping",
          documentationUrl: "https://render.com/docs/free"
        },
        alternativePlatforms: [
          {
            name: "Koyeb",
            freeTierHighlight: "Micro VM with dedicated RAM",
            advantageOverCurrent: "Never sleeps after 15 minutes",
            url: "https://koyeb.com"
          }
        ]
      },
      matchedEvidence: {
        file: "render.yaml",
        matchedPattern: "plan: free"
      },
      confidence: "CONFIRMED_FREE_CONFIG",
      confidenceLabel: "Confirmed Free Configuration"
    };
    state.cliffFindings = [sampleFinding];

    const output = stripAnsi(renderTui(state, 120, 24));
    expect(output).toContain("Render Web Service (Free Instance)");
    expect(output).toContain("After 15 minutes");
    expect(output).toContain("Cold start penalty of 50+ seconds");
    expect(output).toContain("Koyeb");
    expect(output).toContain("https://render.com/docs/free");
  });

  it("should display confirm fix dialog when user triggers automated codemod", () => {
    const state = createBaseState();
    state.viewMode = "confirm_fix";
    state.pendingFix = {
      packageName: "axios",
      itemIndex: 0,
      item: {
        usage: {
          filePath: "src/api.ts",
          line: 42,
          column: 5,
          identifierName: "post",
          sourceSnippet: "axios.post('/auth')",
          isCallExpression: true
        },
        breakingChange: {
          category: "PARAM_ADDED_REQUIRED",
          symbolName: "post",
          severity: "CRITICAL",
          description: "Required config parameter added in axios@1.7.0"
        },
        upstreamRationale: "Upstream changed method signature.",
        runtimeRisk: "Throws invalid arguments error.",
        remediation: {
          beforeCode: "axios.post('/auth')",
          afterCode: "axios.post('/auth', {})",
          explanation: "Add default config object",
          isAutoFixable: true
        }
      }
    };

    const output = stripAnsi(renderTui(state, 120, 24));
    expect(output).toContain("CONFIRM AUTOMATED CODE MODIFICATION");
    expect(output).toContain("src/api.ts:42");
    expect(output).toContain("axios.post('/auth', {})");
    expect(output).toContain("Press [y] to CONFIRM");
  });

  it("should keep search selection in sync and inspect the filtered item, not the unfiltered index", () => {
    const state = createBaseState();
    state.dependencies = [
      {
        id: "npm:package.json:express",
        name: "express",
        currentVersion: "4.18.2",
        isLockfileResolved: true,
        isRangeOnly: false,
        ecosystem: "npm",
        language: "JavaScript",
        manifestFile: "package.json",
        latestVersion: "4.19.2",
        releaseDate: "Mar 2024",
        status: "upgrade_available"
      },
      {
        id: "npm:package.json:lodash",
        name: "lodash",
        currentVersion: "4.17.20",
        isLockfileResolved: true,
        isRangeOnly: false,
        ecosystem: "npm",
        language: "JavaScript",
        manifestFile: "package.json",
        latestVersion: "4.17.21",
        releaseDate: "Feb 2021",
        status: "upgrade_available"
      },
      {
        id: "npm:package.json:react",
        name: "react",
        currentVersion: "18.2.0",
        isLockfileResolved: true,
        isRangeOnly: false,
        ecosystem: "npm",
        language: "JavaScript",
        manifestFile: "package.json",
        latestVersion: "18.3.1",
        releaseDate: "Apr 2024",
        status: "upgrade_available"
      }
    ];

    // Filter by 'react'
    state.searchQuery = "react";
    state.selectedDepIndex = 0; // The first match in the filtered list is react (unfiltered index is 2)
    state.viewMode = "detail";

    const output = stripAnsi(renderTui(state, 120, 24));
    expect(output).toContain("PACKAGE: react (NPM)");
    expect(output).not.toContain("PACKAGE: express");
    expect(output).not.toContain("PACKAGE: lodash");
  });

  it("should store and isolate package analysis by unique ID to prevent collisions across manifests", () => {
    const state = createBaseState();
    const idRoot = "npm:package.json:lodash";
    const idBackend = "npm:packages/backend/package.json:lodash";

    state.dependencies = [
      {
        id: idRoot,
        name: "lodash",
        currentVersion: "3.10.1",
        isLockfileResolved: true,
        isRangeOnly: false,
        ecosystem: "npm",
        language: "JavaScript",
        manifestFile: "package.json",
        latestVersion: "4.17.21",
        releaseDate: "Feb 2021",
        status: "upgrade_available"
      },
      {
        id: idBackend,
        name: "lodash",
        currentVersion: "4.17.20",
        isLockfileResolved: true,
        isRangeOnly: false,
        ecosystem: "npm",
        language: "JavaScript",
        manifestFile: "packages/backend/package.json",
        latestVersion: "4.17.21",
        releaseDate: "Feb 2021",
        status: "upgrade_available"
      }
    ];

    state.analyses[idRoot] = {
      id: idRoot,
      packageName: "lodash",
      ecosystem: "npm",
      targetVersion: "4.17.21",
      fromVersion: "3.10.1",
      loading: false,
      totalUpstreamChanges: 12,
      affectedUsagesCount: 5,
      localUsagesCount: 5,
      isNonNpmAudit: false,
      items: []
    };

    state.analyses[idBackend] = {
      id: idBackend,
      packageName: "lodash",
      ecosystem: "npm",
      targetVersion: "4.17.21",
      fromVersion: "4.17.20",
      loading: false,
      totalUpstreamChanges: 1,
      affectedUsagesCount: 0,
      localUsagesCount: 1,
      isNonNpmAudit: false,
      items: []
    };

    // Inspect the second one (in packages/backend)
    state.selectedDepIndex = 1;
    state.viewMode = "detail";

    const output = stripAnsi(renderTui(state, 120, 24));
    expect(output).toContain("packages/backend/package.json");
    expect(output).toContain("NO BROKEN CALL SITES DETECTED");
    expect(output).not.toContain("5 CALL SITE(S) AFFECTED");
  });

  it("should warn about static AST scanning limitations and show upstream breaking changes when 0 local usages are found", () => {
    const state = createBaseState();
    const pkgId = "npm:package.json:express";

    state.dependencies = [
      {
        id: pkgId,
        name: "express",
        currentVersion: "4.18.2",
        isLockfileResolved: true,
        isRangeOnly: false,
        ecosystem: "npm",
        language: "JavaScript",
        manifestFile: "package.json",
        latestVersion: "5.0.0",
        releaseDate: "Sep 2024",
        status: "upgrade_available"
      }
    ];

    state.analyses[pkgId] = {
      id: pkgId,
      packageName: "express",
      ecosystem: "npm",
      targetVersion: "5.0.0",
      fromVersion: "4.18.2",
      loading: false,
      totalUpstreamChanges: 8,
      affectedUsagesCount: 0,
      localUsagesCount: 0,
      isNonNpmAudit: false,
      items: []
    };

    state.selectedDepIndex = 0;
    state.viewMode = "detail";

    const output = stripAnsi(renderTui(state, 120, 24));
    expect(output).toContain("[NO USAGES DETECTED IN LOCAL CODE]");
    expect(output).toContain("No explicit imports or invocations of 'express' were detected in your scanned files");
    expect(output).toContain("Upstream package introduced 8 breaking change(s)");
    expect(output).toContain("Do NOT assume this upgrade is safe");
    expect(output).not.toContain("Safe to upgrade");
  });

  it("should display [CANNOT DETERMINE] for packages with unknown versions instead of claiming up-to-date", () => {
    const state = createBaseState();
    state.dependencies = [
      {
        id: "npm:package.json:axios",
        name: "axios",
        currentVersion: "unknown",
        requestedRange: "^1.2.0",
        isLockfileResolved: false,
        isRangeOnly: true,
        ecosystem: "npm",
        language: "JavaScript",
        manifestFile: "package.json",
        latestVersion: "1.7.2",
        releaseDate: "May 2024",
        status: "undetermined"
      }
    ];

    const output = stripAnsi(renderTui(state, 120, 24));
    expect(output).toContain("[CANNOT DETERMINE]");
    expect(output).not.toContain("[UP TO DATE]");
    expect(output).toContain("req: ^1.2.0");
  });

  it("should display notice and not compare against a fake lower bound when package has an unlocked range", () => {
    const state = createBaseState();
    const pkgId = "npm:package.json:axios";
    state.dependencies = [
      {
        id: pkgId,
        name: "axios",
        currentVersion: "unknown",
        requestedRange: "^1.2.0",
        isLockfileResolved: false,
        isRangeOnly: true,
        ecosystem: "npm",
        language: "JavaScript",
        manifestFile: "package.json",
        latestVersion: "1.7.2",
        releaseDate: "May 2024",
        status: "undetermined"
      }
    ];

    state.analyses[pkgId] = {
      id: pkgId,
      packageName: "axios",
      ecosystem: "npm",
      targetVersion: "1.7.2",
      fromVersion: "unknown",
      loading: false,
      error: "Cannot perform AST breaking change diff: 'axios' is specified as an unlocked version range (^1.2.0) without a lockfile or node_modules install.",
      totalUpstreamChanges: 0,
      affectedUsagesCount: 0,
      localUsagesCount: 0,
      isNonNpmAudit: false,
      items: []
    };

    state.selectedDepIndex = 0;
    state.viewMode = "detail";

    const output = stripAnsi(renderTui(state, 140, 24));
    expect(output).toContain("Cannot perform AST breaking change diff");
    expect(output).toContain("Requested Range: ^1.2.0");
    expect(output).not.toContain("Installed: 1.2.0");
  });
});

describe("TuiApp Interaction Lifecycle & Keyboard Workflow", () => {
  it("should execute select package -> inspect -> error -> retry workflow cleanly", async () => {
    const app = new TuiApp(process.cwd());
    const state = (app as any).state as TuiState;

    state.dependencies = [
      {
        id: "npm:package.json:axios",
        name: "axios",
        currentVersion: "1.6.0",
        isLockfileResolved: true,
        isRangeOnly: false,
        ecosystem: "npm",
        language: "JavaScript",
        manifestFile: "package.json",
        latestVersion: "1.7.2",
        releaseDate: "May 2024",
        status: "upgrade_available"
      }
    ];
    state.selectedDepIndex = 0;
    state.viewMode = "list";

    // 1. User presses Enter on selected package
    let inspectCallCount = 0;
    app.inspectSelectedDependency = async () => {
      inspectCallCount++;
      state.viewMode = "detail";
      state.analyses["npm:package.json:axios"] = {
        id: "npm:package.json:axios",
        packageName: "axios",
        ecosystem: "npm",
        targetVersion: "1.7.2",
        fromVersion: "1.6.0",
        loading: false,
        error: inspectCallCount === 1 ? "Simulated network timeout" : undefined,
        totalUpstreamChanges: inspectCallCount === 1 ? 0 : 2,
        affectedUsagesCount: 0,
        localUsagesCount: 0,
        isNonNpmAudit: false,
        items: []
      };
    };

    await app.handleKey({ name: "return" });

    // Verifications after Enter
    expect(state.viewMode).toBe("detail");
    expect(inspectCallCount).toBe(1);
    expect(state.analyses["npm:package.json:axios"]?.error).toBe("Simulated network timeout");

    // 2. User presses 'r' on detail screen to retry
    await app.handleKey({ char: "r" });

    // Verifications after 'r' in detail view:
    // It should have executed retry on the detail inspection, NOT a global rescan that wipes state!
    expect(state.viewMode).toBe("detail");
    expect(inspectCallCount).toBe(2);
    expect(state.analyses["npm:package.json:axios"]?.error).toBeUndefined();
    expect(state.analyses["npm:package.json:axios"]?.totalUpstreamChanges).toBe(2);
    expect(state.statusMessage).toContain("Retrying inspection for axios");

    // 3. User navigates back with Escape
    await app.handleKey({ name: "escape" });
    expect(state.viewMode).toBe("list");
  });

  it("should handle detail screen scrolling with up, down, j, k and reset on return", async () => {
    const app = new TuiApp(process.cwd());
    const state = (app as any).state as TuiState;

    state.viewMode = "detail";
    state.detailScrollOffset = 0;

    // Scroll down with 'j' and down arrow
    await app.handleKey({ char: "j" });
    expect(state.detailScrollOffset).toBe(1);

    await app.handleKey({ name: "down" });
    expect(state.detailScrollOffset).toBe(2);

    // Scroll up with 'k' and up arrow
    await app.handleKey({ char: "k" });
    expect(state.detailScrollOffset).toBe(1);

    await app.handleKey({ name: "up" });
    expect(state.detailScrollOffset).toBe(0);

    // Bounded at 0
    await app.handleKey({ name: "up" });
    expect(state.detailScrollOffset).toBe(0);

    // Page down / up
    await app.handleKey({ name: "pagedown" });
    expect(state.detailScrollOffset).toBe(6);

    await app.handleKey({ name: "pageup" });
    expect(state.detailScrollOffset).toBe(0);

    // Back to list resets scroll offset
    await app.handleKey({ char: "j" });
    expect(state.detailScrollOffset).toBe(1);
    await app.handleKey({ char: "b" });
    expect(state.viewMode).toBe("list");
    expect(state.detailScrollOffset).toBe(0);
  });
});

