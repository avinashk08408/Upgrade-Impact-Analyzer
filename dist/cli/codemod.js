import fs from "node:fs/promises";
import path from "node:path";
function isOutsideProject(relativePath) {
    return relativePath === ".." ||
        relativePath.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativePath);
}
export class CodemodEngine {
    projectRoot;
    constructor(projectRoot = process.cwd()) {
        this.projectRoot = path.resolve(projectRoot);
    }
    /**
     * Securely validates that a path resolves strictly inside projectRoot,
     * resolving symlinks and rejecting path traversal (e.g. C:\repo-backup vs C:\repo).
     */
    async validatePath(targetPath) {
        const realProjectRoot = await fs.realpath(this.projectRoot);
        const resolvedTarget = path.resolve(realProjectRoot, targetPath);
        const rel = path.relative(realProjectRoot, resolvedTarget);
        if (isOutsideProject(rel)) {
            throw new Error(`Security restriction: Target path '${targetPath}' is outside the project root.`);
        }
        try {
            const realTarget = await fs.realpath(resolvedTarget);
            const realRel = path.relative(realProjectRoot, realTarget);
            if (isOutsideProject(realRel)) {
                throw new Error(`Security restriction: Path resolves via symlink outside project root.`);
            }
            return realTarget;
        }
        catch (err) {
            if (err.code === "ENOENT") {
                // File does not exist yet (e.g. backup check), check parent directory
                const parentDir = path.dirname(resolvedTarget);
                const realParent = await fs.realpath(parentDir);
                const parentRel = path.relative(realProjectRoot, realParent);
                if (isOutsideProject(parentRel)) {
                    throw new Error(`Security restriction: Target directory is outside the project root.`);
                }
                return resolvedTarget;
            }
            throw err;
        }
    }
    /**
     * Applies automated remediations to consumer files.
     * Only records success after the file has actually been modified and written to disk.
     */
    async applyFixes(items) {
        const results = [];
        const itemsByFile = new Map();
        for (const item of items) {
            const list = itemsByFile.get(item.usage.filePath) ?? [];
            list.push(item);
            itemsByFile.set(item.usage.filePath, list);
        }
        for (const [filePath, fileItems] of itemsByFile.entries()) {
            let securePath;
            try {
                securePath = await this.validatePath(filePath);
            }
            catch (err) {
                results.push({
                    filePath,
                    line: 0,
                    success: false,
                    message: err.message
                });
                continue;
            }
            try {
                const originalContent = await fs.readFile(securePath, "utf-8");
                const lines = originalContent.split("\n");
                fileItems.sort((a, b) => b.usage.line - a.usage.line);
                let fileModified = false;
                const lineResults = [];
                for (const item of fileItems) {
                    // Skip items that are not auto-fixable
                    if (item.remediation && item.remediation.isAutoFixable === false) {
                        lineResults.push({
                            line: item.usage.line,
                            success: false,
                            message: "Automated fix not supported for this change category. Manual migration required.",
                            modified: false
                        });
                        continue;
                    }
                    if (!item.remediation?.beforeCode || !item.remediation?.afterCode) {
                        lineResults.push({
                            line: item.usage.line,
                            success: false,
                            message: "No source transformation was provided.",
                            modified: false
                        });
                        continue;
                    }
                    const lineIdx = item.usage.line - 1;
                    const currentLine = lines[lineIdx];
                    if (!currentLine) {
                        lineResults.push({
                            line: item.usage.line,
                            success: false,
                            message: "Target line number is out of bounds.",
                            modified: false
                        });
                        continue;
                    }
                    const beforeTrimmed = item.remediation.beforeCode.trim();
                    const afterTrimmed = item.remediation.afterCode.trim();
                    if (beforeTrimmed === afterTrimmed) {
                        lineResults.push({
                            line: item.usage.line,
                            success: false,
                            message: "Remediation produces no code change.",
                            modified: false
                        });
                        continue;
                    }
                    if (currentLine.includes(beforeTrimmed)) {
                        lines[lineIdx] = currentLine.replace(beforeTrimmed, afterTrimmed);
                        fileModified = true;
                        lineResults.push({
                            line: item.usage.line,
                            success: true,
                            message: `Replaced invocation for ${item.breakingChange.symbolName}`,
                            modified: true
                        });
                    }
                    else {
                        lineResults.push({
                            line: item.usage.line,
                            success: false,
                            message: "Current line content does not match expected before snippet.",
                            modified: false
                        });
                    }
                }
                if (fileModified) {
                    const newContent = lines.join("\n");
                    if (newContent !== originalContent) {
                        // Write backup file
                        const backupPath = await this.validatePath(`${securePath}.breakcheck.bak`);
                        await fs.writeFile(backupPath, originalContent, "utf-8");
                        // Write modified source file
                        await fs.writeFile(securePath, newContent, "utf-8");
                        for (const lr of lineResults) {
                            results.push({
                                filePath,
                                line: lr.line,
                                success: lr.success,
                                message: lr.message,
                                backupPath: lr.modified ? backupPath : undefined
                            });
                        }
                    }
                    else {
                        for (const lr of lineResults) {
                            results.push({
                                filePath,
                                line: lr.line,
                                success: false,
                                message: "No content was changed."
                            });
                        }
                    }
                }
                else {
                    for (const lr of lineResults) {
                        results.push({
                            filePath,
                            line: lr.line,
                            success: false,
                            message: lr.message
                        });
                    }
                }
            }
            catch (err) {
                results.push({
                    filePath,
                    line: 0,
                    success: false,
                    message: `File write error: ${err?.message || err}`
                });
            }
        }
        return results;
    }
    /**
     * Reverts changes using the saved backup file.
     */
    async revertFix(filePath) {
        let securePath;
        try {
            securePath = await this.validatePath(filePath);
        }
        catch (err) {
            return { success: false, message: err.message };
        }
        try {
            const backupPath = await this.validatePath(`${securePath}.breakcheck.bak`);
            const backupContent = await fs.readFile(backupPath, "utf-8");
            await fs.writeFile(securePath, backupContent, "utf-8");
            await fs.unlink(backupPath);
            return { success: true, message: `Reverted ${filePath} to original state from backup.` };
        }
        catch (err) {
            return { success: false, message: `Revert failed: ${err?.message || "Backup file not found"}` };
        }
    }
}
//# sourceMappingURL=codemod.js.map