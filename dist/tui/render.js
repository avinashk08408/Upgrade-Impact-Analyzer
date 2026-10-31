import pc from "picocolors";
function stripAnsi(str) {
    return str.replace(/\x1b\[[0-9;]*m/g, "");
}
function truncateVisible(str, maxLen) {
    if (maxLen <= 0)
        return "";
    const plain = stripAnsi(str);
    if (plain.length <= maxLen)
        return str;
    return plain.slice(0, Math.max(0, maxLen - 1)) + "…";
}
function padRight(str, width) {
    const vLen = stripAnsi(str).length;
    if (vLen >= width)
        return str;
    return str + " ".repeat(width - vLen);
}
export function getFilteredDependencies(state) {
    if (!state.searchQuery)
        return state.dependencies;
    const q = state.searchQuery.toLowerCase();
    return state.dependencies.filter((d) => d.name.toLowerCase().includes(q) ||
        d.ecosystem.toLowerCase().includes(q) ||
        d.manifestFile.toLowerCase().includes(q));
}
export function renderTui(state, columns, rows) {
    const lines = [];
    // Line 1: Header Top Bar
    const title = pc.bold(pc.bgCyan(pc.black(" BREAKCHECK ")));
    const wsText = ` Workspace: ${pc.bold(state.projectName)} ${pc.gray(`(${state.projectPath})`)}`;
    const line1 = truncateVisible(`${title}${wsText}`, columns);
    lines.push(padRight(line1, columns));
    // Line 2: Navigation Tabs
    const outdatedCount = state.dependencies.filter((d) => d.status === "upgrade_available").length;
    const cliffCount = state.cliffFindings.length;
    const depTabLabel = ` [1] Dependency Upgrades (${outdatedCount} outdated / ${state.dependencies.length}) `;
    const cliffTabLabel = ` [2] Free-Tier Operational Limits (${cliffCount} detected) `;
    const depTab = state.activeTab === "dependencies"
        ? pc.bold(pc.bgWhite(pc.black(depTabLabel)))
        : pc.gray(depTabLabel);
    const cliffTab = state.activeTab === "cliffs"
        ? pc.bold(pc.bgWhite(pc.black(cliffTabLabel)))
        : pc.gray(cliffTabLabel);
    lines.push(padRight(`Tabs: ${depTab} │ ${cliffTab}`, columns));
    // Line 3: Separator line
    lines.push(pc.gray("─".repeat(columns)));
    // Available rows for main body
    const bodyHeight = Math.max(5, rows - 5);
    if (state.viewMode === "help") {
        lines.push(...renderHelpView(columns, bodyHeight));
    }
    else if (state.viewMode === "confirm_fix" && state.pendingFix) {
        lines.push(...renderConfirmFixView(state, columns, bodyHeight));
    }
    else if (state.activeTab === "dependencies") {
        if (state.viewMode === "detail") {
            lines.push(...renderDependencyDetailView(state, columns, bodyHeight));
        }
        else {
            lines.push(...renderDependencyListView(state, columns, bodyHeight));
        }
    }
    else {
        if (state.viewMode === "detail") {
            lines.push(...renderCliffDetailView(state, columns, bodyHeight));
        }
        else {
            lines.push(...renderCliffListView(state, columns, bodyHeight));
        }
    }
    // Ensure line count matches rows exactly
    while (lines.length < rows - 2) {
        lines.push(" ".repeat(columns));
    }
    // Status/Error Message bar (second to last line)
    if (state.statusMessage) {
        lines.push(padRight(pc.yellow(`[STATUS] ${state.statusMessage}`), columns));
    }
    else if (state.isSearching) {
        lines.push(padRight(pc.cyan(`SEARCH: ${state.searchQuery}_ (Press Enter to apply, Esc to cancel)`), columns));
    }
    else if (state.searchQuery) {
        lines.push(padRight(pc.gray(`Filter active: "${state.searchQuery}" (Press Esc or '/' to clear)`), columns));
    }
    else {
        lines.push(padRight(pc.gray("─".repeat(columns)), columns));
    }
    // Footer bar (last line)
    lines.push(padRight(renderFooterBar(state), columns));
    // Truncate to exact screen row limit to avoid vertical scrolling
    return "\x1b[H" + lines.slice(0, rows).map((l) => truncateVisible(l, columns)).join("\n");
}
export function renderDependencyListView(state, columns, maxLines) {
    const result = [];
    const filtered = getFilteredDependencies(state);
    // Table header
    const header = `  ${padRight("ECOSYSTEM", 11)} ${padRight("PACKAGE", 26)} ${padRight("INSTALLED", 16)} ${padRight("LATEST", 14)} ${padRight("STATUS", 22)} MANIFEST`;
    result.push(pc.bold(pc.white(truncateVisible(header, columns))));
    result.push(pc.gray("  " + "─".repeat(Math.max(10, columns - 4))));
    const tableRowsAvailable = maxLines - 2;
    if (state.isLoadingDeps) {
        result.push(pc.cyan("  [SCANNING REPOSITORY FOR DEPENDENCIES ACROSS MULTIPLE ECOSYSTEMS...]"));
        return result;
    }
    if (filtered.length === 0) {
        if (state.dependencies.length === 0) {
            result.push(pc.gray("  No dependencies found in scanned manifest files."));
        }
        else {
            result.push(pc.yellow(`  No dependencies match search query: "${state.searchQuery}"`));
        }
        return result;
    }
    // Ensure selected index is within bounds of filtered list
    const selectedIdx = Math.min(state.selectedDepIndex, filtered.length - 1);
    // Compute scroll window
    let startIdx = state.depScrollOffset;
    if (selectedIdx < startIdx) {
        startIdx = selectedIdx;
    }
    else if (selectedIdx >= startIdx + tableRowsAvailable) {
        startIdx = selectedIdx - tableRowsAvailable + 1;
    }
    const visibleItems = filtered.slice(startIdx, startIdx + tableRowsAvailable);
    for (let i = 0; i < visibleItems.length; i++) {
        const item = visibleItems[i];
        const actualIdx = startIdx + i;
        const isSelected = actualIdx === selectedIdx;
        let statusBadge = "";
        switch (item.status) {
            case "upgrade_available":
                statusBadge = pc.yellow("[UPGRADE AVAILABLE]");
                break;
            case "up_to_date":
                statusBadge = pc.green("[UP TO DATE]");
                break;
            case "undetermined":
                statusBadge = pc.gray("[CANNOT DETERMINE]");
                break;
            case "error":
                statusBadge = pc.red("[CHECK FAILED]");
                break;
            case "loading":
                statusBadge = pc.cyan("[CHECKING...]");
                break;
        }
        const ecoBadge = `[${item.ecosystem.toUpperCase()}]`;
        let installedStr = item.currentVersion;
        if (item.isLockfileResolved) {
            installedStr = `${item.currentVersion} (lock)`;
        }
        else if (item.currentVersion === "unknown" || item.isRangeOnly) {
            installedStr = item.requestedRange ? `req: ${item.requestedRange}` : "unknown";
        }
        const rowText = `  ${padRight(ecoBadge, 11)} ${padRight(item.name, 26)} ${padRight(installedStr, 16)} ${padRight(item.latestVersion, 14)} ${padRight(statusBadge, 22)} ${pc.gray(item.manifestFile)}`;
        if (isSelected) {
            result.push(pc.bgBlue(pc.white(pc.bold(truncateVisible(`►${rowText.slice(1)}`, columns)))));
        }
        else {
            result.push(truncateVisible(rowText, columns));
        }
    }
    return result;
}
export function renderDependencyDetailView(state, columns, maxLines) {
    const result = [];
    const filtered = getFilteredDependencies(state);
    const selectedPkg = filtered[state.selectedDepIndex] || state.dependencies[state.selectedDepIndex];
    if (!selectedPkg) {
        result.push(pc.red("No package selected. Press [Esc] to return to list."));
        return result;
    }
    const analysis = state.analyses[selectedPkg.id] || state.analyses[selectedPkg.name];
    // Header info for selected package
    result.push(pc.bold(pc.white(`PACKAGE: ${selectedPkg.name} (${selectedPkg.ecosystem.toUpperCase()})`)));
    result.push(`Manifest: ${pc.cyan(selectedPkg.manifestFile)}`);
    let versionInfo = `Installed: ${pc.bold(selectedPkg.currentVersion)}`;
    if (selectedPkg.isLockfileResolved) {
        versionInfo += ` ${pc.gray("(resolved from lockfile)")}`;
    }
    else if (selectedPkg.isRangeOnly) {
        versionInfo = `Requested Range: ${pc.yellow(selectedPkg.requestedRange || selectedPkg.currentVersion)} ${pc.yellow("(unlocked range - no lockfile found; exact installed version unknown)")}`;
    }
    else {
        versionInfo += ` ${pc.gray("(pinned in manifest without lockfile)")}`;
    }
    result.push(`${versionInfo} │ Latest: ${pc.bold(selectedPkg.latestVersion)} (Released: ${selectedPkg.releaseDate})`);
    result.push(pc.gray("─".repeat(columns)));
    if (!analysis || analysis.loading) {
        result.push(pc.cyan(`\n  [INSPECTING CODEBASE USAGES FOR ${selectedPkg.name}...]`));
        result.push(pc.gray("  Running AST and lexical call-site scanner against project files..."));
        return result;
    }
    if (analysis.error) {
        if (analysis.error.includes("does not ship built-in TypeScript declarations")) {
            result.push(pc.yellow(pc.bold("\n  [COULD NOT CHECK: NO TYPESCRIPT DEFINITIONS PUBLISHED UPSTREAM]")));
            result.push(pc.gray(`  ${selectedPkg.name} does not ship TypeScript declarations (.d.ts) or a DefinitelyTyped companion.`));
            result.push(pc.yellow("  BreakCheck automated type diffing requires exported TypeScript definitions."));
            result.push(pc.white("\n  Plain Language Summary:"));
            result.push(pc.gray("  The maintainers of this package did not include type definitions (.d.ts). Without types,"));
            result.push(pc.gray("  BreakCheck cannot automatically verify whether function signatures or return types changed."));
            result.push(pc.cyan("\n  What you can do next:"));
            result.push(pc.white(`  1. Check if DefinitelyTyped has declarations: npm i --save-dev @types/${selectedPkg.name.replace(/^@/, "").replace("/", "__")}`));
            result.push(pc.white(`  2. Review the ${selectedPkg.name}@${selectedPkg.latestVersion} changelog and release notes manually.`));
            result.push(pc.gray("\n  Press [r] to retry or [Esc] to return."));
        }
        else if (analysis.error.includes("unlocked version range") || analysis.error.includes("UNLOCKED_VERSION_RANGE") || analysis.error.includes("Cannot perform AST breaking change diff")) {
            result.push(pc.yellow(pc.bold("\n  [COULD NOT CHECK: UNLOCKED VERSION RANGE WITHOUT LOCKFILE]")));
            result.push(pc.gray(`  Cannot perform AST breaking change diff: '${selectedPkg.name}' is specified as an unlocked version range (${selectedPkg.requestedRange || "range"}) without a lockfile or node_modules install.`));
            result.push(pc.white("\n  Plain Language Summary:"));
            result.push(pc.gray("  Your package manifest specifies a version range (like ^1.2.0 or *), but there is no lockfile"));
            result.push(pc.gray("  (package-lock.json, pnpm-lock.yaml, yarn.lock) and no local node_modules installation."));
            result.push(pc.gray("  Without a lockfile, the exact installed version is unknown, so BreakCheck cannot determine"));
            result.push(pc.gray("  which base version to compare against."));
            result.push(pc.cyan("\n  What you can do next:"));
            result.push(pc.white("  1. Run your package manager install command (e.g. 'npm install', 'pnpm install', or 'yarn install')."));
            result.push(pc.white("     This records the exact installed version in a lockfile."));
            result.push(pc.white("  2. Run BreakCheck again and inspect this package."));
            result.push(pc.gray("\n  Press [r] to retry or [Esc] to return."));
        }
        else if (analysis.error.includes("Failed to fetch") || analysis.error.includes("registry") || analysis.error.includes("Failed to find package")) {
            result.push(pc.red(pc.bold("\n  [COULD NOT CHECK: REGISTRY NETWORK LOOKUP FAILED]")));
            result.push(pc.gray(`  BreakCheck could not retrieve package declarations from npm: ${analysis.error}`));
            result.push(pc.white("\n  Plain Language Summary:"));
            result.push(pc.gray("  The package registry could not be reached or the requested version does not exist."));
            result.push(pc.gray("  This can happen if you are offline, behind a proxy, or using a private registry."));
            result.push(pc.cyan("\n  What you can do next:"));
            result.push(pc.white("  1. Check your internet connection or proxy settings."));
            result.push(pc.white("  2. Verify that the package exists on the npm registry."));
            result.push(pc.white("  3. Press [r] to retry the check."));
            result.push(pc.gray("\n  Press [r] to retry or [Esc] to return."));
        }
        else {
            result.push(pc.red(pc.bold(`\n  [COULD NOT CHECK: INSPECTION NOTICE]`)));
            result.push(pc.yellow(`  ${analysis.error}`));
            result.push(pc.white("\n  What you can do next:"));
            result.push(pc.white("  Review the error above, verify project configuration, and press [r] to retry."));
            result.push(pc.gray("  Press [r] to retry or [Esc] to return."));
        }
        const maxScroll = Math.max(0, result.length - maxLines);
        const scrollOffset = Math.min(Math.max(0, state.detailScrollOffset), maxScroll);
        return result.slice(scrollOffset, scrollOffset + maxLines);
    }
    // Ecosystem-specific distinction (Verified npm AST vs Non-npm Call-site Inventory)
    if (selectedPkg.ecosystem === "npm") {
        result.push(pc.bold(pc.cyan("ANALYSIS METHODOLOGY: [AUTOMATED BREAKING-CHANGE COMPARISON] (TypeScript / JavaScript AST)")));
        result.push(pc.gray("BreakCheck compared exported TypeScript definitions between base and target versions against your local AST call sites."));
        result.push("");
        if (analysis.affectedUsagesCount === 0) {
            if (analysis.localUsagesCount === 0) {
                result.push(pc.yellow(pc.bold("  [NO USAGES DETECTED IN LOCAL CODE]")));
                result.push(pc.white("  Plain Language Summary:"));
                result.push(pc.gray(`  No explicit imports or invocations of '${selectedPkg.name}' were detected in your scanned files (including CommonJS require calls).`));
                result.push(pc.yellow("  Safety Warning: 'No usages detected' does NOT guarantee that upgrading is safe."));
                result.push(pc.gray("  The package may be invoked dynamically (eval, dynamic import, CLI, or by another dependency)."));
                if (analysis.totalUpstreamChanges > 0) {
                    result.push(pc.red(`  Notice: Upstream package introduced ${analysis.totalUpstreamChanges} breaking change(s) between v${analysis.fromVersion} and v${analysis.targetVersion}.`));
                    result.push(pc.gray("  Do NOT assume this upgrade is safe if this package is used indirectly or dynamically."));
                }
                else {
                    result.push(pc.gray(`  Zero breaking changes detected in exported type definitions upstream between v${analysis.fromVersion} and v${analysis.targetVersion}.`));
                }
            }
            else {
                result.push(pc.green(pc.bold("  [NO BROKEN CALL SITES DETECTED IN EXPLICIT CODE]")));
                result.push(pc.white("  Plain Language Summary:"));
                result.push(pc.gray(`  Found ${analysis.localUsagesCount} usage(s) in local code. None of these specific call sites conflict with the new version's type definitions.`));
                result.push(pc.yellow("  Safety Warning: Static type checking does NOT guarantee complete upgrade safety."));
                result.push(pc.gray("  Runtime behavior changes, polyfills, altered return values, and dynamic calls are not covered by type definitions."));
                if (analysis.totalUpstreamChanges > 0) {
                    result.push(pc.gray(`  (Upstream package has ${analysis.totalUpstreamChanges} breaking change(s) on unreferenced symbols).`));
                }
            }
        }
        else {
            result.push(pc.red(pc.bold(`  [!] ${analysis.affectedUsagesCount} CALL SITE(S) AFFECTED BY BREAKING CHANGES`)));
            result.push(pc.white("  Plain Language Summary:"));
            result.push(pc.gray(`  The upstream package changed signatures or removed exports that your code directly calls.`));
            result.push(pc.gray(`  Upgrading without updating the lines below may cause compiler errors or runtime failures.`));
            result.push(pc.gray(`  Total upstream breaking change(s) detected: ${analysis.totalUpstreamChanges}`));
            result.push("");
            for (let i = 0; i < analysis.items.length; i++) {
                const item = analysis.items[i];
                result.push(pc.bold(pc.yellow(`  • [${item.breakingChange.severity}] ${item.usage.filePath}:${item.usage.line}`)));
                result.push(`    Symbol:      ${pc.bold(item.breakingChange.symbolName)} (${item.breakingChange.category.replace(/_/g, " ")})`);
                result.push(`    Runtime Risk: ${pc.red(item.runtimeRisk)}`);
                result.push(`    Upstream Why: ${pc.gray(item.upstreamRationale)}`);
                result.push(`    Current Line: ${pc.dim(item.remediation.beforeCode)}`);
                result.push(`    Suggested:    ${pc.green(item.remediation.afterCode)}`);
                if (item.remediation.isAutoFixable) {
                    result.push(pc.cyan(`    Action: Press [f] to apply verified fix to line ${item.usage.line} (requires confirmation)`));
                }
                result.push("");
            }
        }
    }
    else {
        // Non-npm ecosystems (Python, Rust, Go, PHP, Ruby)
        result.push(pc.bold(pc.blue(`ANALYSIS METHODOLOGY: [CALL-SITE INVENTORY FOR MANUAL REVIEW] (${selectedPkg.ecosystem.toUpperCase()} Call-Site Usage Inventory)`)));
        result.push(pc.white("Plain Language Summary:"));
        result.push(pc.gray(`Automated AST type diffing is active only for TypeScript/npm. For ${selectedPkg.ecosystem.toUpperCase()}, BreakCheck`));
        result.push(pc.gray("finds everywhere you use this package so you can manually check those lines against official release notes."));
        result.push(pc.yellow("It does NOT automatically prove or disprove breaking changes for this ecosystem."));
        result.push("");
        if (analysis.affectedUsagesCount === 0) {
            result.push(pc.yellow(pc.bold("  [NO EXPLICIT CALL SITES DETECTED IN SCANNED FILES]")));
            result.push(pc.gray(`  No explicit imports or invocations of '${selectedPkg.name}' were detected by the lexical scanner.`));
            result.push(pc.yellow("  Important: This does not guarantee the upgrade is safe. Verify indirect dependencies, CLI calls, runtime plugins, or dynamic references before upgrading."));
        }
        else {
            result.push(pc.blue(pc.bold(`  [CALL-SITE INVENTORY FOR MANUAL REVIEW] ${analysis.affectedUsagesCount} Active Invocation(s) Found:`)));
            result.push(pc.gray(`  Review each call site against the official ${selectedPkg.name}@${selectedPkg.latestVersion} migration notes before updating:`));
            result.push("");
            for (let i = 0; i < analysis.items.length; i++) {
                const item = analysis.items[i];
                result.push(pc.bold(`  • ${item.usage.filePath}:${item.usage.line}`));
                result.push(`    Invocation:  ${pc.cyan(item.usage.sourceSnippet)}`);
                result.push(`    Hazard:      ${pc.gray(item.runtimeRisk)}`);
                result.push("");
            }
        }
    }
    const maxScroll = Math.max(0, result.length - maxLines);
    const scrollOffset = Math.min(Math.max(0, state.detailScrollOffset), maxScroll);
    return result.slice(scrollOffset, scrollOffset + maxLines);
}
export function renderCliffListView(state, columns, maxLines) {
    const result = [];
    const header = `  ${padRight("PROVIDER", 16)} ${padRight("SERVICE", 22)} ${padRight("PLAN", 14)} ${padRight("THE CLIFF / TRIGGER", 28)} CONFIDENCE`;
    result.push(pc.bold(pc.white(truncateVisible(header, columns))));
    result.push(pc.gray("  " + "─".repeat(Math.max(10, columns - 4))));
    if (state.isLoadingCliffs) {
        result.push(pc.cyan("  [AUDITING REPOSITORY FOR CLOUD HOSTING & DATABASE LIMITS...]"));
        return result;
    }
    if (state.cliffError) {
        result.push(pc.bold(pc.red(`  [ERROR] Cloud boundary scan failed: ${state.cliffError}`)));
        result.push(pc.yellow("  Press 'r' to retry repository scan."));
        return result;
    }
    if (state.cliffFindings.length === 0) {
        result.push(pc.green("  [OK] No hidden free-tier pause, sleep, or timeout limits detected in project configs."));
        return result;
    }
    const tableRowsAvailable = maxLines - 2;
    const selectedIdx = Math.min(state.selectedCliffIndex, state.cliffFindings.length - 1);
    let startIdx = state.cliffScrollOffset;
    if (selectedIdx < startIdx) {
        startIdx = selectedIdx;
    }
    else if (selectedIdx >= startIdx + tableRowsAvailable) {
        startIdx = selectedIdx - tableRowsAvailable + 1;
    }
    const visibleItems = state.cliffFindings.slice(startIdx, startIdx + tableRowsAvailable);
    for (let i = 0; i < visibleItems.length; i++) {
        const item = visibleItems[i];
        const actualIdx = startIdx + i;
        const isSelected = actualIdx === selectedIdx;
        const confBadge = item.confidence === "CONFIRMED_FREE_CONFIG"
            ? pc.red("[CONFIRMED]")
            : pc.yellow("[POSSIBLE]");
        const rowText = `  ${padRight(item.rule.provider, 16)} ${padRight(item.rule.service, 22)} ${padRight(item.rule.plan, 14)} ${padRight(item.rule.timeToFailure, 28)} ${confBadge}`;
        if (isSelected) {
            result.push(pc.bgBlue(pc.white(pc.bold(truncateVisible(`►${rowText.slice(1)}`, columns)))));
        }
        else {
            result.push(truncateVisible(rowText, columns));
        }
    }
    return result;
}
export function renderCliffDetailView(state, columns, maxLines) {
    const result = [];
    const finding = state.cliffFindings[state.selectedCliffIndex];
    if (!finding) {
        result.push(pc.red("No cloud boundary selected. Press [Esc] to return."));
        return result;
    }
    const { rule, matchedEvidence, confidence } = finding;
    result.push(pc.bold(pc.white(`CLOUD SERVICE: ${rule.provider} ${rule.service} (${rule.plan})`)));
    result.push(`Confidence: ${confidence === "CONFIRMED_FREE_CONFIG" ? pc.red("Confirmed Free Configuration") : pc.yellow("Possible - Please Confirm Plan Tier")} │ Detected in: ${pc.cyan(matchedEvidence.file)}`);
    result.push(pc.gray("─".repeat(columns)));
    if (rule.wakeBehavior) {
        result.push(pc.bold(pc.magenta(`• Mechanism: ${rule.wakeBehavior.mechanismLabel}`)));
        result.push(`  Wakes Automatically on Next Request: ${rule.wakeBehavior.wakesOnNextRequest ? "Yes" : "No (Manual Dashboard Resumption Required)"}`);
        result.push(`  First-Request Latency Penalty: ${rule.wakeBehavior.firstRequestLatency}`);
        result.push(`  Behavior: ${rule.wakeBehavior.explanation}`);
        result.push(`  Notice: ${rule.wakeBehavior.breakcheckDisclaimer}`);
        result.push("");
    }
    result.push(pc.bold(pc.red(`• The Cliff Trigger: ${rule.timeToFailure}`)));
    result.push(`  ${rule.triggerCondition}`);
    result.push("");
    result.push(pc.bold(pc.yellow("• Production Failure Mode & Impact:")));
    result.push(`  ${rule.impactDescription}`);
    result.push("");
    result.push(pc.bold(pc.cyan("• Recommended Solution:")));
    result.push(`  ${rule.recommendedFix.summary}`);
    result.push(`  Documentation: ${pc.underline(rule.recommendedFix.documentationUrl)}`);
    result.push("");
    if (rule.backupSpecification) {
        result.push(pc.bold(pc.yellow("• Specific Database Backup & Recovery Guidance:")));
        result.push(`  What is backed up: ${rule.backupSpecification.whatIsBackedUp}`);
        result.push(`  What is NOT backed up: ${rule.backupSpecification.whatIsNotBackedUp}`);
        result.push(`  Storage: ${rule.backupSpecification.storageLocation} (Retention: ${rule.backupSpecification.retentionPeriod})`);
        result.push(`  Restore Command: ${rule.backupSpecification.restoreInstructions}`);
        if (rule.backupSpecification.cacheDisclaimer) {
            result.push(`  Cache Note: ${rule.backupSpecification.cacheDisclaimer}`);
        }
        result.push("");
    }
    if (rule.automatedProtections && rule.automatedProtections.length > 0) {
        result.push(pc.bold(pc.green("• Automated Protections (Copyable Examples - Not Currently Active):")));
        for (const prot of rule.automatedProtections) {
            result.push(`  - [${prot.type.replace(/_/g, " ")}] ${pc.bold(prot.title)}`);
            result.push(`    ${prot.description}`);
            if (prot.requiredConfiguration) {
                result.push(`    Required Secrets: ${Object.keys(prot.requiredConfiguration).join(", ")}`);
            }
        }
        result.push("");
    }
    if (rule.alternativePlatforms && rule.alternativePlatforms.length > 0) {
        result.push(pc.bold(pc.blue("• Recommended Alternative Free Platforms (Verified October 2026):")));
        for (const alt of rule.alternativePlatforms) {
            result.push(`  - ${pc.bold(alt.name)} (${alt.category}): ${alt.freeTierLimits}`);
            result.push(`    Advantage: ${alt.advantageOverCurrent}`);
            result.push(`    Migration Effort: ${alt.migrationEffort} - ${alt.migrationDetails} (${alt.officialSourceUrl})`);
        }
    }
    const maxScroll = Math.max(0, result.length - maxLines);
    const scrollOffset = Math.min(Math.max(0, state.detailScrollOffset), maxScroll);
    return result.slice(scrollOffset, scrollOffset + maxLines);
}
export function renderConfirmFixView(state, columns, maxLines) {
    const result = [];
    const pending = state.pendingFix;
    result.push(pc.bold(pc.bgYellow(pc.black(" CONFIRM AUTOMATED CODE MODIFICATION "))));
    result.push(pc.gray("─".repeat(columns)));
    if (!pending) {
        result.push("No pending fix.");
        return result;
    }
    result.push(`Target File:  ${pc.bold(pc.cyan(pending.item.usage.filePath))}:${pending.item.usage.line}`);
    result.push(`Package:      ${pc.bold(pending.packageName)}`);
    result.push(`Change:       ${pending.item.breakingChange.description}`);
    result.push("");
    result.push(pc.bold("Current Code:"));
    result.push(pc.red(`  - ${pending.item.remediation.beforeCode}`));
    result.push("");
    result.push(pc.bold("Proposed Remediation:"));
    result.push(pc.green(`  + ${pending.item.remediation.afterCode}`));
    result.push("");
    result.push(pc.gray("BreakCheck creates a safety backup (.breakcheck.bak) before modifying disk."));
    result.push("");
    result.push(pc.bold(pc.white("Press [y] to CONFIRM and write change  │  Press [n] or [Esc] to CANCEL")));
    return result.slice(0, maxLines);
}
export function renderHelpView(columns, maxLines) {
    const result = [];
    result.push(pc.bold(pc.bgWhite(pc.black(" BREAKCHECK KEYBOARD SHORTCUTS "))));
    result.push(pc.gray("─".repeat(columns)));
    result.push("");
    result.push("  Tab / 1 / 2      Switch between Dependency Upgrades and Free-Tier Limits");
    result.push("  ↑ / ↓ / j / k    Navigate rows up and down");
    result.push("  Enter            Open detailed inspection for selected item");
    result.push("  /                Filter/search dependencies by name");
    result.push("  Esc / b          Back to list view / Cancel search");
    result.push("  f                Apply verified codemod fix (with confirmation prompt)");
    result.push("  r                Re-scan project and refresh registry metadata");
    result.push("  ?                Toggle this help screen");
    result.push("  q / Ctrl+C       Quit BreakCheck and restore terminal");
    result.push("");
    result.push(pc.gray("Press [Esc] or [?] to close this help window."));
    return result.slice(0, maxLines);
}
export function renderFooterBar(state) {
    if (state.viewMode === "detail") {
        return pc.gray(" [Esc/b] Back to List │ [↑/↓/j/k] Scroll Report │ [r] Retry │ [?] Help │ [q] Quit");
    }
    if (state.viewMode === "confirm_fix") {
        return pc.yellow(" [y] Confirm Fix │ [n/Esc] Cancel Fix");
    }
    return pc.gray(" [Tab/1/2] Switch Tab │ [↑/↓/j/k] Navigate │ [Enter] Details │ [/] Search │ [r] Refresh │ [?] Help │ [q] Quit");
}
//# sourceMappingURL=render.js.map