import path from "node:path";
import { TerminalManager, type KeyEvent } from "./terminal.js";
import { renderTui, getFilteredDependencies } from "./render.js";
import type { TuiState, DependencyItem, PackageAnalysisState } from "./types.js";
import { ManifestParser } from "../multilang/manifestParsers.js";
import { MultiLangRegistryClient } from "../multilang/registryClients.js";
import { MultiLangUsageScanner } from "../multilang/usageScanner.js";
import { CliffScanner } from "../cliff/scanner.js";
import { isVersionOutdated } from "../server/apiHandler.js";
import { ProjectScanner } from "../scanner/projectScanner.js";
import { DeclarationLoader } from "../diff/declarationLoader.js";
import { TypeDiffEngine } from "../diff/typeDiffEngine.js";
import { ImpactCorrelator } from "../engine/impactCorrelator.js";
import { RegistryFetcher } from "../utils/registry.js";
import { CodemodEngine } from "../cli/codemod.js";
import fs from "node:fs/promises";

export class TuiApp {
  private terminal: TerminalManager;
  private state: TuiState;
  private isRunning: boolean = false;

  constructor(projectPath: string = process.cwd()) {
    const resolvedPath = path.resolve(projectPath);
    this.terminal = new TerminalManager();

    this.state = {
      projectPath: resolvedPath,
      projectName: path.basename(resolvedPath),
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
      isLoadingDeps: true,
      isLoadingCliffs: true
    };
  }

  public async start(): Promise<void> {
    this.isRunning = true;
    this.terminal.enterScreen();

    this.terminal.onResize(() => {
      this.draw();
    });

    this.terminal.onKey((key: KeyEvent) => {
      this.handleKey(key);
    });

    this.draw();

    // Trigger initial repository scans
    await Promise.all([
      this.scanDependencies(),
      this.scanCliffs()
    ]);

    this.draw();
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.terminal.leaveScreen();
  }

  public getState(): Readonly<TuiState> {
    return this.state;
  }

  public draw(): void {
    if (!this.isRunning) return;
    const columns = this.terminal.getColumns();
    const rows = this.terminal.getRows();
    const screenOutput = renderTui(this.state, columns, rows);
    this.terminal.write(screenOutput);
  }

  public async scanDependencies(): Promise<void> {
    MultiLangRegistryClient.clearCache();
    this.state.isLoadingDeps = true;
    if (this.state.viewMode === "list") {
      this.state.analyses = {};
    }
    this.draw();

    try {
      const discovered = await ManifestParser.discoverAllDependencies(this.state.projectPath);

      const items: DependencyItem[] = discovered.map((d) => ({
        id: d.id,
        name: d.name,
        currentVersion: d.currentVersion,
        requestedRange: d.requestedRange,
        isLockfileResolved: d.isLockfileResolved,
        isRangeOnly: d.isRangeOnly,
        ecosystem: d.ecosystem,
        language: d.language,
        manifestFile: d.manifestFile,
        latestVersion: "...",
        releaseDate: "...",
        status: "loading"
      }));

      this.state.dependencies = items;
      this.state.isLoadingDeps = false;
      this.draw();

      // Fetch metadata from registries in parallel
      await Promise.all(
        items.map(async (item) => {
          try {
            const meta = await MultiLangRegistryClient.getPackageMetadata(item.name, item.ecosystem);
            item.latestVersion = meta.latestVersion;
            item.releaseDate = meta.releaseDate;

            if (meta.latestVersion === "latest" && meta.releaseDate === "Unknown") {
              item.status = "error";
              item.errorMessage = "Failed to fetch registry metadata";
            } else {
              const outdated = isVersionOutdated(item.currentVersion, meta.latestVersion);
              if (outdated === null) {
                item.status = "undetermined";
                item.errorMessage = item.currentVersion === "unknown"
                  ? `Installed version could not be determined (range: ${item.requestedRange || "none"})`
                  : "Version could not be determined";
              } else if (outdated) {
                item.status = "upgrade_available";
              } else {
                item.status = "up_to_date";
              }
            }
          } catch (err: any) {
            item.status = "error";
            item.errorMessage = err.message || "Registry request failed";
          }
          this.draw();
        })
      );
    } catch (err: any) {
      this.state.isLoadingDeps = false;
      this.state.statusMessage = `Dependency scan failed: ${err.message}`;
    }

    this.draw();
  }

  public async scanCliffs(): Promise<void> {
    this.state.isLoadingCliffs = true;
    this.state.cliffError = undefined;
    this.draw();

    try {
      const scanner = new CliffScanner(this.state.projectPath);
      const summary = await scanner.scan();
      this.state.cliffFindings = summary.findings;
      this.state.cliffError = undefined;
    } catch (err: any) {
      this.state.cliffError = err.message || String(err);
      this.state.statusMessage = `Cloud boundary scan failed: ${err.message}`;
    } finally {
      this.state.isLoadingCliffs = false;
    }

    this.draw();
  }

  public async inspectSelectedDependency(): Promise<void> {
    const list = getFilteredDependencies(this.state);
    const pkg = list[this.state.selectedDepIndex] || this.state.dependencies[this.state.selectedDepIndex];
    if (!pkg) return;

    this.state.detailScrollOffset = 0;
    const analysisKey = pkg.id;
    const targetVersion = pkg.latestVersion !== "..." ? pkg.latestVersion : "latest";
    const cached = this.state.analyses[analysisKey];

    // Only reuse cache if it succeeded without error, is not loading, and matches current & target versions
    if (
      cached &&
      !cached.loading &&
      !cached.error &&
      cached.fromVersion === pkg.currentVersion &&
      cached.targetVersion === targetVersion
    ) {
      this.state.viewMode = "detail";
      this.draw();
      return;
    }

    const analysisState: PackageAnalysisState = {
      id: pkg.id,
      packageName: pkg.name,
      ecosystem: pkg.ecosystem,
      targetVersion,
      fromVersion: pkg.currentVersion,
      loading: true,
      totalUpstreamChanges: 0,
      affectedUsagesCount: 0,
      localUsagesCount: 0,
      items: [],
      isNonNpmAudit: pkg.ecosystem !== "npm"
    };

    this.state.analyses[analysisKey] = analysisState;
    this.state.viewMode = "detail";
    this.draw();

    try {
      if (pkg.ecosystem === "npm") {
        // Guard against diffing from an unlocked range without a known installed version
        if (pkg.currentVersion === "unknown" || (pkg.isRangeOnly && !pkg.isLockfileResolved)) {
          analysisState.loading = false;
          analysisState.error = `Cannot perform AST breaking change diff: '${pkg.name}' is specified as an unlocked version range (${pkg.requestedRange || "unlocked"}) without a lockfile or node_modules install. An exact installed base version is required to verify breaking changes against your code.`;
          this.draw();
          return;
        }

        // Deep TypeScript / JavaScript AST pipeline
        const tsConfigCandidate = path.join(this.state.projectPath, "tsconfig.json");
        let scanner: ProjectScanner;
        try {
          await fs.access(tsConfigCandidate);
          scanner = new ProjectScanner(tsConfigCandidate);
        } catch {
          scanner = new ProjectScanner();
          scanner.addSourceFilesFromPattern(path.join(this.state.projectPath, "**/*.{ts,js,tsx,jsx}"));
        }

        const usages = scanner.scanForPackageUsage(pkg.name);
        analysisState.localUsagesCount = usages.length;

        const fetcher = new RegistryFetcher();
        const baseSpec = `${pkg.name}@${pkg.currentVersion}`;
        const targetSpec = pkg.latestVersion !== "..." && pkg.latestVersion !== "latest"
          ? `${pkg.name}@${pkg.latestVersion}`
          : `${pkg.name}@latest`;

        const baseBundle = await fetcher.fetchPackageDeclarations(baseSpec);
        const targetBundle = await fetcher.fetchPackageDeclarations(targetSpec);

        const baseLoader = new DeclarationLoader();
        const targetLoader = new DeclarationLoader();
        const baseSymbols = baseLoader.parseDeclarations(baseBundle.entryDtsContent, "base.d.ts");
        const targetSymbols = targetLoader.parseDeclarations(targetBundle.entryDtsContent, "target.d.ts");

        const diffEngine = new TypeDiffEngine();
        const breakingChanges = diffEngine.diff(baseSymbols, targetSymbols);

        const correlator = new ImpactCorrelator();
        const summary = correlator.correlate(
          pkg.name,
          pkg.currentVersion,
          targetBundle.version || targetSpec,
          usages,
          breakingChanges
        );

        analysisState.loading = false;
        analysisState.totalUpstreamChanges = summary.totalUpstreamChanges;
        analysisState.affectedUsagesCount = summary.affectedUsagesCount;
        analysisState.items = summary.items;
        analysisState.scanScope = summary.scanScope;
      } else {
        // Multi-language call-site inventory
        const usages = await MultiLangUsageScanner.scanPackageUsages(
          this.state.projectPath,
          pkg.name,
          pkg.ecosystem
        );

        analysisState.loading = false;
        analysisState.localUsagesCount = usages.length;
        analysisState.affectedUsagesCount = usages.length;
        analysisState.items = usages.map((usage) => ({
          usage,
          breakingChange: {
            category: "USAGE_AUDIT",
            symbolName: usage.identifierName,
            severity: "INFO",
            description: `Active invocation of '${usage.identifierName}' in ${usage.filePath}:${usage.line}.`
          },
          upstreamRationale:
            `Identified explicit reference to '${usage.identifierName}' in your ${pkg.ecosystem.toUpperCase()} codebase.`,
          runtimeRisk:
            `Verify argument signatures and return types against ${pkg.name}@${pkg.latestVersion} release notes before upgrading.`,
          remediation: {
            beforeCode: usage.sourceSnippet,
            afterCode: usage.sourceSnippet,
            explanation: `Review ${pkg.name}@${pkg.latestVersion} changelog for API modifications.`,
            isAutoFixable: false
          }
        }));
      }
    } catch (err: any) {
      analysisState.loading = false;
      analysisState.error = err.message || "Failed to inspect package";
    }

    this.draw();
  }

  public async handleKey(key: KeyEvent): Promise<void> {
    // 1. Search Mode handling
    if (this.state.isSearching) {
      if (key.name === "escape") {
        this.state.isSearching = false;
        this.state.searchQuery = "";
        this.state.selectedDepIndex = 0;
        this.state.depScrollOffset = 0;
        this.draw();
        return;
      }
      if (key.name === "return") {
        this.state.isSearching = false;
        this.draw();
        return;
      }
      if (key.name === "backspace") {
        this.state.searchQuery = this.state.searchQuery.slice(0, -1);
        this.state.selectedDepIndex = 0;
        this.state.depScrollOffset = 0;
        this.draw();
        return;
      }
      if (key.char && key.char.length === 1 && !key.ctrl && !key.meta) {
        this.state.searchQuery += key.char;
        this.state.selectedDepIndex = 0;
        this.state.depScrollOffset = 0;
        this.draw();
        return;
      }
      return;
    }

    // 2. Confirm Fix Mode handling
    if (this.state.viewMode === "confirm_fix") {
      if (key.char === "y" || key.char === "Y") {
        await this.applyPendingFix();
        return;
      }
      if (key.name === "escape" || key.char === "n" || key.char === "N") {
        this.state.pendingFix = undefined;
        this.state.viewMode = "detail";
        this.state.statusMessage = "Fix cancelled.";
        this.draw();
        return;
      }
      return;
    }

    // 3. Help Mode handling
    if (this.state.viewMode === "help") {
      if (key.name === "escape" || key.char === "?" || key.char === "q") {
        this.state.viewMode = "list";
        this.draw();
        return;
      }
      return;
    }

    // 4. Global navigation keys
    if (key.char === "q" || (key.ctrl && key.name === "c")) {
      this.stop();
      process.exit(0);
    }

    if (key.char === "?") {
      this.state.viewMode = "help";
      this.draw();
      return;
    }

    if (key.char === "1") {
      this.state.activeTab = "dependencies";
      this.state.viewMode = "list";
      this.state.detailScrollOffset = 0;
      this.draw();
      return;
    }

    if (key.char === "2") {
      this.state.activeTab = "cliffs";
      this.state.viewMode = "list";
      this.state.detailScrollOffset = 0;
      this.draw();
      return;
    }

    if (key.name === "tab") {
      this.state.activeTab = this.state.activeTab === "dependencies" ? "cliffs" : "dependencies";
      this.state.viewMode = "list";
      this.state.detailScrollOffset = 0;
      this.draw();
      return;
    }

    // 5. Detail View Mode keys (handled before list-view keys to ensure 'r' retries the detail inspection)
    if (this.state.viewMode === "detail") {
      if (key.char === "r") {
        const list = getFilteredDependencies(this.state);
        const pkg = list[this.state.selectedDepIndex] || this.state.dependencies[this.state.selectedDepIndex];
        if (pkg) {
          MultiLangRegistryClient.evict(pkg.name, pkg.ecosystem);
          delete this.state.analyses[pkg.id];
          delete this.state.analyses[pkg.name];
          this.state.detailScrollOffset = 0;
          this.state.statusMessage = `Retrying inspection for ${pkg.name}...`;
          this.draw();

          // Refresh metadata in case of previous network failure
          try {
            const meta = await MultiLangRegistryClient.getPackageMetadata(pkg.name, pkg.ecosystem);
            if (meta.latestVersion !== "latest" && meta.latestVersion !== "unknown") {
              pkg.latestVersion = meta.latestVersion;
              pkg.releaseDate = meta.releaseDate;
              const outdated = isVersionOutdated(pkg.currentVersion, meta.latestVersion);
              if (outdated === null) {
                pkg.status = "undetermined";
              } else if (outdated) {
                pkg.status = "upgrade_available";
              } else {
                pkg.status = "up_to_date";
              }
            }
          } catch {
            // Keep existing metadata state
          }

          await this.inspectSelectedDependency();
        }
        return;
      }

      if (key.name === "escape" || key.char === "b" || key.name === "backspace") {
        this.state.viewMode = "list";
        this.state.statusMessage = undefined;
        this.state.detailScrollOffset = 0;
        this.draw();
        return;
      }

      if (key.name === "up" || key.char === "k") {
        this.state.detailScrollOffset = Math.max(0, this.state.detailScrollOffset - 1);
        this.draw();
        return;
      }

      if (key.name === "down" || key.char === "j") {
        this.state.detailScrollOffset = this.state.detailScrollOffset + 1;
        this.draw();
        return;
      }

      if (key.name === "pageup") {
        this.state.detailScrollOffset = Math.max(0, this.state.detailScrollOffset - 6);
        this.draw();
        return;
      }

      if (key.name === "pagedown") {
        this.state.detailScrollOffset = this.state.detailScrollOffset + 6;
        this.draw();
        return;
      }

      if (key.char === "f" && this.state.activeTab === "dependencies") {
        const list = getFilteredDependencies(this.state);
        const pkg = list[this.state.selectedDepIndex] || this.state.dependencies[this.state.selectedDepIndex];
        const analysis = pkg ? (this.state.analyses[pkg.id] || this.state.analyses[pkg.name]) : null;
        if (analysis && analysis.items.length > 0) {
          const fixableIdx = analysis.items.findIndex((item) => item.remediation.isAutoFixable);
          if (fixableIdx !== -1) {
            this.state.pendingFix = {
              item: analysis.items[fixableIdx],
              packageId: pkg.id,
              packageName: pkg.name,
              itemIndex: fixableIdx
            };
            this.state.viewMode = "confirm_fix";
            this.draw();
            return;
          }
        }
        this.state.statusMessage = "No automated fix available for this item.";
        this.draw();
        return;
      }
      return;
    }

    // 6. List View Mode keys
    if (this.state.viewMode === "list") {
      if (key.char === "r") {
        this.state.statusMessage = "Re-scanning workspace...";
        Promise.all([this.scanDependencies(), this.scanCliffs()]).then(() => {
          this.state.statusMessage = "Scan complete.";
          this.draw();
        });
        return;
      }

      if (key.char === "/") {
        this.state.isSearching = true;
        this.draw();
        return;
      }

      if (key.name === "escape") {
        if (this.state.searchQuery) {
          this.state.searchQuery = "";
          this.state.selectedDepIndex = 0;
          this.state.depScrollOffset = 0;
          this.draw();
          return;
        }
      }

      if (key.name === "up" || key.char === "k") {
        if (this.state.activeTab === "dependencies") {
          const list = getFilteredDependencies(this.state);
          const max = Math.max(0, list.length - 1);
          this.state.selectedDepIndex = Math.min(max, Math.max(0, this.state.selectedDepIndex - 1));
        } else {
          this.state.selectedCliffIndex = Math.max(0, this.state.selectedCliffIndex - 1);
        }
        this.draw();
        return;
      }

      if (key.name === "down" || key.char === "j") {
        if (this.state.activeTab === "dependencies") {
          const list = getFilteredDependencies(this.state);
          const max = Math.max(0, list.length - 1);
          this.state.selectedDepIndex = Math.min(max, this.state.selectedDepIndex + 1);
        } else {
          const max = Math.max(0, this.state.cliffFindings.length - 1);
          this.state.selectedCliffIndex = Math.min(max, this.state.selectedCliffIndex + 1);
        }
        this.draw();
        return;
      }

      if (key.name === "return") {
        this.state.detailScrollOffset = 0;
        if (this.state.activeTab === "dependencies") {
          await this.inspectSelectedDependency();
        } else {
          if (this.state.cliffFindings.length > 0) {
            this.state.viewMode = "detail";
            this.draw();
          }
        }
        return;
      }
    }
  }

  private async applyPendingFix(): Promise<void> {
    if (!this.state.pendingFix) return;
    const { item, packageId, packageName } = this.state.pendingFix;

    try {
      const codemod = new CodemodEngine(this.state.projectPath);
      const results = await codemod.applyFixes([item]);
      const successful = results.some((r) => r.success);

      if (successful) {
        this.state.statusMessage = `Fix verified and applied to ${item.usage.filePath}:${item.usage.line} (backup created).`;
        // Refresh analysis
        delete this.state.analyses[packageId];
        delete this.state.analyses[packageName];
        await this.inspectSelectedDependency();
      } else {
        const msg = results[0]?.message || "Fix failed to modify file";
        this.state.statusMessage = `Failed: ${msg}`;
      }
    } catch (err: any) {
      this.state.statusMessage = `Failed to apply fix: ${err.message}`;
    } finally {
      this.state.pendingFix = undefined;
      this.state.viewMode = "detail";
      this.draw();
    }
  }
}
