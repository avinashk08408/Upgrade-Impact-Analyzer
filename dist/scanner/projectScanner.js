import { Project, Node, SyntaxKind } from "ts-morph";
export class ProjectScanner {
    project;
    constructor(tsConfigPath) {
        if (tsConfigPath) {
            this.project = new Project({
                tsConfigFilePath: tsConfigPath,
                skipAddingFilesFromTsConfig: false
            });
        }
        else {
            this.project = new Project({
                compilerOptions: {
                    allowJs: true
                }
            });
        }
    }
    addSourceFilesFromPattern(pattern) {
        this.project.addSourceFilesAtPaths(pattern);
    }
    addSourceFileFromText(filePath, content) {
        return this.project.createSourceFile(filePath, content, { overwrite: true });
    }
    scanForPackageUsage(packageName) {
        const usages = [];
        const sourceFiles = this.project.getSourceFiles();
        for (const sourceFile of sourceFiles) {
            const importDeclarations = sourceFile.getImportDeclarations();
            for (const importDecl of importDeclarations) {
                const moduleSpecifier = importDecl.getModuleSpecifierValue();
                if (moduleSpecifier !== packageName && !moduleSpecifier.startsWith(`${packageName}/`)) {
                    continue;
                }
                // 1. Named imports: import { a, b as c } from 'pkg'
                const namedImports = importDecl.getNamedImports();
                for (const namedImport of namedImports) {
                    const importedName = namedImport.getName();
                    const aliasNode = namedImport.getAliasNode();
                    const localIdentifier = aliasNode ?? namedImport.getNameNode();
                    this.collectIdentifierReferences(localIdentifier, importedName, sourceFile, usages);
                }
                // 2. Default import: import pkg from 'pkg'
                const defaultImport = importDecl.getDefaultImport();
                if (defaultImport) {
                    this.collectDefaultOrNamespaceReferences(defaultImport, "default", sourceFile, usages);
                }
                // 3. Namespace import: import * as pkg from 'pkg'
                const namespaceImport = importDecl.getNamespaceImport();
                if (namespaceImport) {
                    this.collectDefaultOrNamespaceReferences(namespaceImport, "*", sourceFile, usages);
                }
            }
            // 4. CommonJS require and dynamic import calls
            const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
            for (const call of callExpressions) {
                const expression = call.getExpression();
                const exprText = expression.getText();
                if (exprText === "require" || exprText === "import") {
                    const args = call.getArguments();
                    if (args.length > 0) {
                        const firstArg = args[0];
                        const argText = firstArg.getText().replace(/['"`]/g, "");
                        if (argText === packageName || argText.startsWith(`${packageName}/`)) {
                            const parent = call.getParent();
                            if (Node.isVariableDeclaration(parent)) {
                                const nameNode = parent.getNameNode();
                                if (Node.isObjectBindingPattern(nameNode)) {
                                    for (const elem of nameNode.getElements()) {
                                        const propName = elem.getPropertyNameNode()?.getText() || elem.getName();
                                        const localId = elem.getNameNode();
                                        this.collectIdentifierReferences(localId, propName, sourceFile, usages);
                                    }
                                }
                                else if (Node.isIdentifier(nameNode)) {
                                    this.collectDefaultOrNamespaceReferences(nameNode, "*", sourceFile, usages);
                                }
                            }
                            else {
                                const { line, column } = sourceFile.getLineAndColumnAtPos(call.getStart());
                                const sourceLine = sourceFile.getFullText().split("\n")[line - 1] ?? "";
                                usages.push({
                                    filePath: sourceFile.getFilePath(),
                                    line,
                                    column,
                                    identifierName: "default",
                                    sourceSnippet: sourceLine.trim(),
                                    argumentCount: args.length,
                                    isCallExpression: true
                                });
                            }
                        }
                    }
                }
            }
        }
        return usages;
    }
    collectIdentifierReferences(identifierNode, originalSymbolName, sourceFile, usages) {
        const references = identifierNode.findReferencesAsNodes();
        for (const ref of references) {
            // Skip the import statement itself
            if (ref === identifierNode || ref.getParentIfKind(SyntaxKind.ImportSpecifier)) {
                continue;
            }
            const refFile = ref.getSourceFile();
            const parent = ref.getParent();
            const isCall = Node.isCallExpression(parent) && parent.getExpression() === ref;
            const argumentCount = isCall ? parent.getArguments().length : undefined;
            const { line, column } = refFile.getLineAndColumnAtPos(ref.getStart());
            const sourceLine = refFile.getFullText().split("\n")[line - 1] ?? "";
            usages.push({
                filePath: refFile.getFilePath(),
                line,
                column,
                identifierName: originalSymbolName,
                sourceSnippet: sourceLine.trim(),
                argumentCount,
                isCallExpression: isCall
            });
        }
    }
    collectDefaultOrNamespaceReferences(bindingNode, importType, sourceFile, usages) {
        const references = bindingNode.findReferencesAsNodes();
        for (const ref of references) {
            if (ref === bindingNode || ref.getParentIfKind(SyntaxKind.ImportClause) || ref.getParentIfKind(SyntaxKind.NamespaceImport)) {
                continue;
            }
            const refFile = ref.getSourceFile();
            const parent = ref.getParent();
            // Check for property access: e.g., axios.post(...) or lodash.map(...)
            if (Node.isPropertyAccessExpression(parent) && parent.getExpression() === ref) {
                const accessedPropertyName = parent.getName();
                const grandParent = parent.getParent();
                const isCall = Node.isCallExpression(grandParent) && grandParent.getExpression() === parent;
                const argumentCount = isCall ? grandParent.getArguments().length : undefined;
                const { line, column } = refFile.getLineAndColumnAtPos(parent.getStart());
                const sourceLine = refFile.getFullText().split("\n")[line - 1] ?? "";
                usages.push({
                    filePath: refFile.getFilePath(),
                    line,
                    column,
                    identifierName: accessedPropertyName,
                    sourceSnippet: sourceLine.trim(),
                    argumentCount,
                    isCallExpression: isCall
                });
            }
            else if (Node.isCallExpression(parent) && parent.getExpression() === ref) {
                // Direct call of default import: e.g. axios('/url')
                const { line, column } = refFile.getLineAndColumnAtPos(ref.getStart());
                const sourceLine = refFile.getFullText().split("\n")[line - 1] ?? "";
                usages.push({
                    filePath: refFile.getFilePath(),
                    line,
                    column,
                    identifierName: importType === "default" ? "default" : "*",
                    sourceSnippet: sourceLine.trim(),
                    argumentCount: parent.getArguments().length,
                    isCallExpression: true
                });
            }
        }
    }
}
//# sourceMappingURL=projectScanner.js.map