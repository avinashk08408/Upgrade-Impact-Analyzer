import fs from "node:fs/promises";
import path from "node:path";
import type { ConsumerUsage } from "../types.js";
import type { Ecosystem } from "./manifestParsers.js";

const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", "build", ".venv", "venv", "vendor", "target"]);

async function findFilesWithExtension(dir: string, extensions: string[], baseDir: string = dir): Promise<string[]> {
  let files: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const sub = await findFilesWithExtension(fullPath, extensions, baseDir);
        files = files.concat(sub);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions.includes(ext)) {
          files.push(path.relative(baseDir, fullPath).replace(/\\/g, "/"));
        }
      }
    }
  } catch {
    // Ignore unreadable dirs
  }
  return files;
}

export class MultiLangUsageScanner {
  public static async scanPackageUsages(
    projectRoot: string,
    packageName: string,
    ecosystem: Ecosystem
  ): Promise<ConsumerUsage[]> {
    const usages: ConsumerUsage[] = [];

    switch (ecosystem) {
      case "pypi": {
        // Python: Scan .py files
        const pyFiles = await findFilesWithExtension(projectRoot, [".py"]);
        const normalizedPkg = packageName.replace(/-/g, "_");

        for (const relFile of pyFiles) {
          const fullPath = path.join(projectRoot, relFile);
          try {
            const content = await fs.readFile(fullPath, "utf-8");
            const lines = content.split("\n");

            // Track aliases and directly imported functions: e.g. import pkg as alias, from pkg import func1, func2
            const aliases = new Set<string>([normalizedPkg]);
            const importedSymbols = new Set<string>();

            for (const line of lines) {
              const aliasMatch = line.match(new RegExp(`\\bimport\\s+${normalizedPkg}\\s+as\\s+([a-zA-Z0-9_]+)`));
              if (aliasMatch) aliases.add(aliasMatch[1]);

              const fromMatch = line.match(new RegExp(`\\bfrom\\s+${normalizedPkg}(?:\\.[a-zA-Z0-9_]+)?\\s+import\\s+([^#\\n]+)`));
              if (fromMatch) {
                const names = fromMatch[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0].trim());
                for (const n of names) {
                  if (n && n !== "*") importedSymbols.add(n);
                }
              }
            }

            for (let i = 0; i < lines.length; i++) {
              const lineText = lines[i];
              const lineNum = i + 1;

              // Check for import statement
              const importMatch = lineText.match(new RegExp(`\\b(import\\s+${normalizedPkg}\\b|from\\s+${normalizedPkg}\\b)`));

              // Check for method call on package or alias: pkg.func() or alias.func()
              let callMatch: RegExpMatchArray | null = null;
              for (const alias of aliases) {
                const m = lineText.match(new RegExp(`\\b${alias}\\.([a-zA-Z0-9_]+)\\s*\\(`));
                if (m) {
                  callMatch = m;
                  break;
                }
              }

              // Check for direct call to imported symbol: func()
              let directSymCall: string | null = null;
              if (!callMatch) {
                for (const sym of importedSymbols) {
                  if (new RegExp(`\\b${sym}\\s*\\(`).test(lineText)) {
                    directSymCall = sym;
                    break;
                  }
                }
              }

              if (importMatch || callMatch || directSymCall) {
                const identifierName = callMatch ? callMatch[1] : (directSymCall || packageName);
                usages.push({
                  filePath: relFile,
                  line: lineNum,
                  column: 1,
                  identifierName,
                  sourceSnippet: lineText.trim(),
                  isCallExpression: !!(callMatch || directSymCall)
                });
              }
            }
          } catch {
            // Ignore file read errors
          }
        }
        break;
      }

      case "cargo": {
        // Rust: Scan .rs files
        const rsFiles = await findFilesWithExtension(projectRoot, [".rs"]);
        const crateName = packageName.replace(/-/g, "_");

        for (const relFile of rsFiles) {
          const fullPath = path.join(projectRoot, relFile);
          try {
            const content = await fs.readFile(fullPath, "utf-8");
            const lines = content.split("\n");

            for (let i = 0; i < lines.length; i++) {
              const lineText = lines[i];
              const lineNum = i + 1;

              const useMatch = lineText.match(new RegExp(`\\buse\\s+${crateName}::`));
              const callMatch = lineText.match(new RegExp(`\\b${crateName}::([a-zA-Z0-9_]+)\\s*\\(`));

              if (useMatch || callMatch) {
                const identifierName = callMatch ? callMatch[1] : packageName;
                usages.push({
                  filePath: relFile,
                  line: lineNum,
                  column: 1,
                  identifierName,
                  sourceSnippet: lineText.trim(),
                  isCallExpression: !!callMatch
                });
              }
            }
          } catch {
            // Ignore
          }
        }
        break;
      }

      case "go": {
        // Go: Scan .go files
        const goFiles = await findFilesWithExtension(projectRoot, [".go"]);
        const shortName = packageName.split("/").pop() || packageName;

        for (const relFile of goFiles) {
          const fullPath = path.join(projectRoot, relFile);
          try {
            const content = await fs.readFile(fullPath, "utf-8");
            const lines = content.split("\n");

            for (let i = 0; i < lines.length; i++) {
              const lineText = lines[i];
              const lineNum = i + 1;

              const importMatch = lineText.includes(`"${packageName}"`);
              const callMatch = lineText.match(new RegExp(`\\b${shortName}\\.([A-Z][a-zA-Z0-9_]+)\\s*\\(`));

              if (importMatch || callMatch) {
                const identifierName = callMatch ? callMatch[1] : shortName;
                usages.push({
                  filePath: relFile,
                  line: lineNum,
                  column: 1,
                  identifierName,
                  sourceSnippet: lineText.trim(),
                  isCallExpression: !!callMatch
                });
              }
            }
          } catch {
            // Ignore
          }
        }
        break;
      }

      case "composer": {
        // PHP: Scan .php files
        const phpFiles = await findFilesWithExtension(projectRoot, [".php"]);
        const shortName = packageName.split("/").pop() || packageName;

        for (const relFile of phpFiles) {
          const fullPath = path.join(projectRoot, relFile);
          try {
            const content = await fs.readFile(fullPath, "utf-8");
            const lines = content.split("\n");

            for (let i = 0; i < lines.length; i++) {
              const lineText = lines[i];
              const lineNum = i + 1;

              const useMatch = lineText.match(new RegExp(`\\buse\\s+.*${shortName}\\b`, "i"));
              const callMatch = lineText.match(new RegExp(`\\$${shortName}->([a-zA-Z0-9_]+)\\s*\\(`, "i"));

              if (useMatch || callMatch) {
                const identifierName = callMatch ? callMatch[1] : shortName;
                usages.push({
                  filePath: relFile,
                  line: lineNum,
                  column: 1,
                  identifierName,
                  sourceSnippet: lineText.trim(),
                  isCallExpression: !!callMatch
                });
              }
            }
          } catch {
            // Ignore
          }
        }
        break;
      }

      case "rubygems": {
        // Ruby: Scan .rb files
        const rbFiles = await findFilesWithExtension(projectRoot, [".rb"]);
        const shortName = packageName.replace(/-/g, "_");

        for (const relFile of rbFiles) {
          const fullPath = path.join(projectRoot, relFile);
          try {
            const content = await fs.readFile(fullPath, "utf-8");
            const lines = content.split("\n");

            for (let i = 0; i < lines.length; i++) {
              const lineText = lines[i];
              const lineNum = i + 1;

              const reqMatch = lineText.match(new RegExp(`\\brequire\\s+['"]${packageName}['"]`));
              const callMatch = lineText.match(new RegExp(`\\b${shortName}::([a-zA-Z0-9_]+)\\s*\\(`, "i"));

              if (reqMatch || callMatch) {
                const identifierName = callMatch ? callMatch[1] : shortName;
                usages.push({
                  filePath: relFile,
                  line: lineNum,
                  column: 1,
                  identifierName,
                  sourceSnippet: lineText.trim(),
                  isCallExpression: !!callMatch
                });
              }
            }
          } catch {
            // Ignore
          }
        }
        break;
      }
    }

    return usages;
  }
}

