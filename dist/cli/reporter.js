import pc from "picocolors";
import { RiskCalculator } from "../engine/riskScore.js";
export class Reporter {
    static printSummary(summary) {
        const divider = "================================================================================";
        const subDivider = "--------------------------------------------------------------------------------";
        console.log();
        console.log(pc.bold(`[BREAKCHECK] Dependency Upgrade Impact Analysis`));
        console.log(`Target: ${summary.packageName} (${summary.currentVersion} -> ${summary.targetVersion})`);
        console.log(`Total upstream changes: ${summary.totalUpstreamChanges} | Usages in your code affecting you: ${summary.affectedUsagesCount}`);
        console.log();
        if (summary.items.length === 0) {
            console.log(divider);
            console.log(pc.green(pc.bold(`STATUS: SAFE TO UPGRADE`)));
            console.log(`None of the ${summary.totalUpstreamChanges} upstream changes affect any function, method, or symbol you consume.`);
            console.log(divider);
            console.log();
            return;
        }
        const tier = RiskCalculator.getRiskTier(summary.riskScore);
        const tierColor = tier === "CRITICAL" || tier === "HIGH"
            ? pc.red
            : tier === "MEDIUM"
                ? pc.yellow
                : pc.cyan;
        console.log(divider);
        console.log(tierColor(pc.bold(`STATUS: ${tier} RISK (Score: ${summary.riskScore}/100)`)));
        console.log(divider);
        for (let i = 0; i < summary.items.length; i++) {
            const item = summary.items[i];
            const categoryLabel = item.breakingChange.category.replace(/_/g, " ");
            console.log();
            console.log(pc.bold(`[ISSUE ${i + 1}/${summary.items.length}] ${item.breakingChange.severity}: ${categoryLabel}`));
            console.log(subDivider);
            console.log(pc.bold("Location:"));
            console.log(`  File: ${item.usage.filePath}`);
            console.log(`  Line: ${item.usage.line}, Column: ${item.usage.column}`);
            console.log();
            console.log(pc.bold("Your Code:"));
            console.log(`  ${item.usage.line} | ${item.usage.sourceSnippet}`);
            console.log();
            console.log(pc.bold("Upstream Rationale (Why the library author made this change):"));
            console.log(`  ${item.upstreamRationale}`);
            console.log();
            console.log(pc.bold("Runtime Risk (Consequence if left unfixed):"));
            console.log(`  ${item.runtimeRisk}`);
            console.log();
            console.log(pc.bold("Recommended Remediation:"));
            console.log(`  Before: ${item.remediation.beforeCode}`);
            console.log(`  After:  ${item.remediation.afterCode}`);
            console.log();
            console.log(pc.bold("Why This Fix Works:"));
            console.log(`  ${item.remediation.explanation}`);
            console.log(subDivider);
        }
        console.log();
        console.log(pc.bold("Summary Recommendation:"));
        if (tier === "CRITICAL" || tier === "HIGH") {
            console.log(pc.red("Do not upgrade this dependency until the critical issues listed above are remediated in your source code."));
        }
        else {
            console.log(pc.yellow("Review the warnings above before merging the upgrade."));
        }
        console.log();
    }
    static printJson(summary) {
        console.log(JSON.stringify(summary, null, 2));
    }
    static printMarkdown(summary) {
        const tier = RiskCalculator.getRiskTier(summary.riskScore);
        const lines = [];
        lines.push(`## [BREAKCHECK] Dependency Upgrade Impact Report`);
        lines.push(`**Package:** \`${summary.packageName}\` (\`${summary.currentVersion}\` -> \`${summary.targetVersion}\`)`);
        lines.push(`**Status:** ${tier} RISK (Score: ${summary.riskScore}/100)`);
        lines.push(`**Total upstream changes:** ${summary.totalUpstreamChanges} | **Affecting this codebase:** ${summary.affectedUsagesCount}`);
        lines.push("");
        if (summary.items.length === 0) {
            lines.push("> **SAFE TO UPGRADE:** None of the upstream changes intersect with symbols called in this repository.");
            console.log(lines.join("\n"));
            return;
        }
        lines.push("| Severity | Category | File | Line |");
        lines.push("| :--- | :--- | :--- | :--- |");
        for (const item of summary.items) {
            lines.push(`| **${item.breakingChange.severity}** | ${item.breakingChange.category} | \`${item.usage.filePath}\` | Line ${item.usage.line} |`);
        }
        lines.push("");
        for (let i = 0; i < summary.items.length; i++) {
            const item = summary.items[i];
            lines.push(`### Issue ${i + 1}: ${item.breakingChange.symbolName} (${item.breakingChange.category})`);
            lines.push(`- **Location:** \`${item.usage.filePath}:${item.usage.line}:${item.usage.column}\``);
            lines.push(`- **Upstream Rationale:** ${item.upstreamRationale}`);
            lines.push(`- **Runtime Hazard:** ${item.runtimeRisk}`);
            lines.push("- **Remediation Plan:**");
            lines.push("```typescript");
            lines.push(`// Before:`);
            lines.push(item.remediation.beforeCode);
            lines.push(`// After:`);
            lines.push(item.remediation.afterCode);
            lines.push("```");
            lines.push(`- **Why this fix works:** ${item.remediation.explanation}`);
            lines.push("");
        }
        console.log(lines.join("\n"));
    }
    static printCodemodSummary(results) {
        console.log();
        console.log(pc.bold("[BREAKCHECK CODEMOD] Automated Remediation Summary"));
        for (const res of results) {
            if (res.success) {
                console.log(pc.green(`  [SUCCESS] ${res.filePath}:${res.line} - ${res.message}`));
            }
            else {
                console.log(pc.red(`  [FAILED]  ${res.filePath}:${res.line} - ${res.message}`));
            }
        }
        console.log();
    }
}
//# sourceMappingURL=reporter.js.map