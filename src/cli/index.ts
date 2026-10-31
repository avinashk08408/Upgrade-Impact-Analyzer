import { Command } from "commander";
import path from "node:path";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import pc from "picocolors";
import { ProjectScanner } from "../scanner/projectScanner.js";
import { DeclarationLoader } from "../diff/declarationLoader.js";
import { TypeDiffEngine } from "../diff/typeDiffEngine.js";
import { ImpactCorrelator } from "../engine/impactCorrelator.js";
import { RegistryFetcher } from "../utils/registry.js";
import { Reporter } from "./reporter.js";
import { CodemodEngine } from "./codemod.js";
import { startWebServer } from "../server/index.js";
import { ManifestParser } from "../multilang/manifestParsers.js";
import { CliffScanner } from "../cliff/scanner.js";
import { MultiLangRegistryClient } from "../multilang/registryClients.js";
import { isVersionOutdated } from "../server/apiHandler.js";
import { TuiApp } from "../tui/app.js";

const program = new Command();

program
  .name("breakcheck")
  .description("Analyze whether an npm dependency upgrade will break your specific codebase.")
  .version("1.0.0")
  .argument("[targetPackage]", "Target package specification (e.g., axios@1.7.0 or lodash@4.18.0)")
  .option("-p, --project <path>", "Path to consumer project root or tsconfig.json", process.cwd())
  .option("--from <version>", "Explicit base version to compare from (default: installed version)")
  .option("--json", "Output results in JSON format")
  .option("--markdown", "Output results in GitHub-flavored Markdown format")
  .option("--fix", "Automatically apply remediations to consumer files")
  .option("--fail-on <severity>", "Exit code 1 threshold: 'CRITICAL' or 'WARNING'", "CRITICAL")
  .option("-w, --watch", "Live track code and cloud configuration changes in the terminal (OpenCode style)")
  .option("--ui", "Launch the minimal, professional React web dashboard")
  .option("--port <port>", "Port for the web UI server (default: 3456)", "3456")
  .action(async (targetPackageSpec: string | undefined, options: {
    project: string;
    from?: string;
    json?: boolean;
    markdown?: boolean;
    fix?: boolean;
    failOn: string;
    ui?: boolean;
    watch?: boolean;
    port: string;
  }) => {
    try {
      // 1. If explicit --ui flag, launch web server without auto-opening browser
      if (options.ui) {
        startWebServer({
          port: parseInt(options.port, 10) || 3456,
          projectPath: options.project,
          autoOpen: false
        });
        return;
      }

      // 2. If no target package specified (or --watch given), launch the interactive TUI
      if (!targetPackageSpec || options.watch) {
        const app = new TuiApp(path.resolve(options.project));
        await app.start();
        return;
      }

      const atIndex = targetPackageSpec.lastIndexOf("@");
      let pkgName = targetPackageSpec;
      let targetVersion = "latest";

      if (atIndex > 0) {
        pkgName = targetPackageSpec.substring(0, atIndex);
        targetVersion = targetPackageSpec.substring(atIndex + 1);
      }

      const isQuietMode = options.json || options.markdown;

      if (!isQuietMode) {
        console.log(pc.cyan(`[INFO] Scanning consumer project for usages of '${pkgName}'...`));
      }

      // 2. Scan consumer project
      const projectPath = path.resolve(options.project);
      const tsConfigCandidate = path.join(projectPath, "tsconfig.json");
      let scanner: ProjectScanner;

      try {
        await fs.access(tsConfigCandidate);
        scanner = new ProjectScanner(tsConfigCandidate);
      } catch {
        scanner = new ProjectScanner();
        scanner.addSourceFilesFromPattern(path.join(projectPath, "**/*.{ts,js,tsx,jsx}"));
      }

      const usages = scanner.scanForPackageUsage(pkgName);

      if (!isQuietMode) {
        console.log(pc.cyan(`[INFO] Found ${usages.length} references to '${pkgName}' in local code.`));
      }

      // If user doesn't even use this package, safe exit!
      if (usages.length === 0) {
        if (options.json) {
          Reporter.printJson({
            packageName: pkgName,
            currentVersion: options.from || "unknown",
            targetVersion,
            totalUpstreamChanges: 0,
            affectedUsagesCount: 0,
            riskScore: 0,
            items: []
          });
        } else if (options.markdown) {
          Reporter.printMarkdown({
            packageName: pkgName,
            currentVersion: options.from || "unknown",
            targetVersion,
            totalUpstreamChanges: 0,
            affectedUsagesCount: 0,
            riskScore: 0,
            items: []
          });
        } else {
          console.log(pc.yellow(`[INFO] No explicit references to '${pkgName}' detected by static AST scanner.`));
          console.log(pc.gray("Note: Dynamic imports or unexported reflection calls are not verified."));
        }
        process.exit(0);
      }

      // 3. Fetch base (old) declarations
      const fetcher = new RegistryFetcher();
      let currentVersion = options.from || "installed";
      let oldDtsContent = "";

      if (options.from) {
        if (!isQuietMode) {
          console.log(pc.cyan(`[INFO] Downloading base '${pkgName}@${options.from}' typings from npm...`));
        }
        const baseBundle = await fetcher.fetchPackageDeclarations(`${pkgName}@${options.from}`);
        oldDtsContent = baseBundle.entryDtsContent;
        currentVersion = baseBundle.version;
      } else {
        const localPackageJson = path.join(projectPath, "node_modules", pkgName, "package.json");
        try {
          const localPkgJsonRaw = await fs.readFile(localPackageJson, "utf-8");
          const localPkg = JSON.parse(localPkgJsonRaw);
          currentVersion = localPkg.version || "installed";

          const localDtsRel = localPkg.types || localPkg.typings || (localPkg.exports?.["."]?.types) || "index.d.ts";
          const localDtsPath = path.join(projectPath, "node_modules", pkgName, localDtsRel);
          oldDtsContent = await fs.readFile(localDtsPath, "utf-8");
        } catch {
          oldDtsContent = "";
        }
      }

      // 4. Fetch remote declaration for target version
      if (!isQuietMode) {
        console.log(pc.cyan(`[INFO] Downloading target '${targetPackageSpec}' typings from npm...`));
      }

      const remoteBundle = await fetcher.fetchPackageDeclarations(targetPackageSpec);

      // 5. Parse declarations and diff
      const loader = new DeclarationLoader();
      const oldSymbols = loader.parseDeclarations(oldDtsContent, "old.d.ts");
      const newSymbols = loader.parseDeclarations(remoteBundle.entryDtsContent, "new.d.ts");

      const diffEngine = new TypeDiffEngine();
      const breakingChanges = diffEngine.diff(oldSymbols, newSymbols);

      // 6. Correlate with consumer usages
      const correlator = new ImpactCorrelator();
      const summary = correlator.correlate(
        pkgName,
        currentVersion,
        remoteBundle.version,
        usages,
        breakingChanges
      );

      // 7. Apply automated fixes if requested
      if (options.fix && summary.items.length > 0) {
        const codemod = new CodemodEngine();
        const results = await codemod.applyFixes(summary.items);
        Reporter.printCodemodSummary(results);
      }

      // 8. Output report
      if (options.json) {
        Reporter.printJson(summary);
      } else if (options.markdown) {
        Reporter.printMarkdown(summary);
      } else {
        Reporter.printSummary(summary);
      }

      // 9. Exit code logic
      const shouldFail =
        options.failOn.toUpperCase() === "WARNING"
          ? summary.items.some((i) => i.breakingChange.severity === "CRITICAL" || i.breakingChange.severity === "WARNING")
          : summary.items.some((i) => i.breakingChange.severity === "CRITICAL");

      if (shouldFail) {
        process.exit(1);
      } else {
        process.exit(0);
      }
    } catch (error: any) {
      console.error(pc.red(`[ERROR] ${error?.message || error}`));
      process.exit(1);
    }
  });

async function runLiveTerminalWatcher(projectPath: string, port: number) {
  console.clear();
  console.log(pc.bold(pc.cyan("=== BreakCheck Terminal Inspector (OpenCode Terminal Mode) ===")));
  console.log(pc.gray(`Workspace: ${projectPath}`));
  console.log(pc.gray("Live-monitoring code edits, dependency changes, and cloud configs. Press Ctrl+C to exit.\n"));

  let isScanning = false;
  const executeInspection = async () => {
    if (isScanning) return;
    isScanning = true;
    try {
      console.log(pc.yellow(`[${new Date().toLocaleTimeString()}] Scanning Codebase & Cloud Boundaries...`));

      // 1. Discover Multi-Language Dependencies with registry metadata
      const deps = await ManifestParser.discoverAllDependencies(projectPath);
      console.log(pc.bold(pc.white(`\nProject Dependencies (${deps.length} detected):`)));

      const sampleDeps = deps.slice(0, 15);
      const pkgWithMeta = await Promise.all(
        sampleDeps.map(async (dep) => {
          const reg = await MultiLangRegistryClient.getPackageMetadata(dep.name, dep.ecosystem);
          const isOutdated = isVersionOutdated(dep.currentVersion, reg.latestVersion);
          return { ...dep, latestVersion: reg.latestVersion, releaseDate: reg.releaseDate, isOutdated };
        })
      );

      for (const p of pkgWithMeta) {
        const statusStr = p.isOutdated ? pc.yellow("Upgrade Available") : pc.green("Up to Date");
        const lockStr = p.isLockfileResolved ? pc.gray("[lock]") : "      ";
        console.log(
          `  ${pc.bold(p.name.padEnd(26))} ${p.currentVersion.padEnd(10)} ${lockStr} -> ${p.latestVersion.padEnd(10)} [${statusStr}] ${pc.gray(p.releaseDate)}`
        );
      }
      if (deps.length > 15) {
        console.log(pc.gray(`  ... and ${deps.length - 15} more dependencies.`));
      }

      // 2. Discover Free-Tier Cloud Limits
      const cliffScanner = new CliffScanner(projectPath);
      const cliffSummary = await cliffScanner.scan();
      console.log(pc.bold(pc.white(`\nFree-Tier Operational Boundaries (${cliffSummary.findingsCount} detected):`)));
      if (cliffSummary.findingsCount === 0) {
        console.log(pc.green("  [OK] No hidden free-tier sleep or pause limits detected in project configs."));
      } else {
        for (const finding of cliffSummary.findings) {
          console.log(pc.red(`  [ALERT] ${finding.rule.provider} ${finding.rule.service} (${finding.rule.plan})`));
          console.log(`    Detected In:   ${pc.yellow(finding.matchedEvidence.file)}`);
          console.log(`    Trigger:       ${finding.rule.timeToFailure}`);
          console.log(`    Disadvantage:  ${finding.rule.triggerCondition}`);
          console.log(`    Hazard:        ${finding.rule.impactDescription}`);
          if (finding.rule.alternativePlatforms && finding.rule.alternativePlatforms.length > 0) {
            const alt = finding.rule.alternativePlatforms[0];
            console.log(pc.green(`    Alternative:   ${alt.name} (${alt.freeTierLimits || alt.freeTierHighlight}) - ${alt.advantageOverCurrent}`));
          }
          if (finding.rule.automatedProtections && finding.rule.automatedProtections.length > 0) {
            const prot = finding.rule.automatedProtections[0];
            console.log(pc.cyan(`    Protection:    ${prot.title} (${prot.type.replace(/_/g, " ")})`));
          }
        }
      }
      console.log(pc.gray(`\nLive Watcher Active: Edit any project code or config file to re-scan.`));
    } catch (err: any) {
      console.error(pc.red(`Live inspection failed: ${err.message}`));
    } finally {
      isScanning = false;
    }
  };

  await executeInspection();

  let debounceTimer: any = null;
  fsSync.watch(projectPath, { recursive: true }, (_eventType, filename) => {
    if (!filename) return;
    if (
      filename.includes("node_modules") ||
      filename.includes(".git") ||
      filename.includes("dist") ||
      filename.includes(".breakcheck.bak")
    ) {
      return;
    }

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      console.log(pc.magenta(`\n[CHANGE DETECTED] ${filename}`));
      executeInspection();
    }, 500);
  });
}

program.parse();
