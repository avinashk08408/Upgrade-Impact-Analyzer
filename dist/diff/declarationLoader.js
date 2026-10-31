import { Project, Node } from "ts-morph";
export class DeclarationLoader {
    project;
    constructor() {
        this.project = new Project({
            compilerOptions: {
                allowJs: true,
                declaration: true
            }
        });
    }
    parseDeclarations(sourceCode, virtualPath = "index.d.ts") {
        const sourceFile = this.project.createSourceFile(virtualPath, sourceCode, { overwrite: true });
        return this.extractExportedSymbols(sourceFile);
    }
    extractExportedSymbols(sourceFile) {
        const symbolMap = new Map();
        // 1. Exported functions
        for (const fn of sourceFile.getFunctions()) {
            if (!fn.isExported())
                continue;
            const name = fn.getName() ?? "default";
            const signatures = this.extractFunctionSignatures(fn);
            const { isDeprecated, deprecationNotice, jsDocComment } = this.extractJsDocInfo(fn);
            symbolMap.set(name, {
                name,
                kind: "function",
                signatures,
                isDeprecated,
                deprecationNotice,
                jsDocComment
            });
        }
        // 2. Exported variables / arrow functions
        for (const statement of sourceFile.getVariableStatements()) {
            if (!statement.isExported())
                continue;
            for (const decl of statement.getDeclarations()) {
                const name = decl.getName();
                const { isDeprecated, deprecationNotice, jsDocComment } = this.extractJsDocInfo(statement);
                const signatures = this.extractVariableSignatures(decl);
                symbolMap.set(name, {
                    name,
                    kind: signatures.length > 0 ? "function" : "variable",
                    signatures,
                    isDeprecated,
                    deprecationNotice,
                    jsDocComment
                });
            }
        }
        // 3. Exported classes
        for (const cls of sourceFile.getClasses()) {
            if (!cls.isExported())
                continue;
            const name = cls.getName() ?? "default";
            const { isDeprecated, deprecationNotice, jsDocComment } = this.extractJsDocInfo(cls);
            symbolMap.set(name, {
                name,
                kind: "class",
                signatures: [],
                isDeprecated,
                deprecationNotice,
                jsDocComment
            });
            // Also record exported methods if needed
            for (const method of cls.getMethods()) {
                const methodName = `${name}.${method.getName()}`;
                const methodSignatures = this.extractFunctionSignatures(method);
                const methodDoc = this.extractJsDocInfo(method);
                symbolMap.set(methodName, {
                    name: methodName,
                    kind: "function",
                    signatures: methodSignatures,
                    isDeprecated: methodDoc.isDeprecated,
                    deprecationNotice: methodDoc.deprecationNotice,
                    jsDocComment: methodDoc.jsDocComment
                });
            }
        }
        // 4. Exported interfaces and type aliases
        for (const iface of sourceFile.getInterfaces()) {
            if (!iface.isExported())
                continue;
            const name = iface.getName();
            const { isDeprecated, deprecationNotice, jsDocComment } = this.extractJsDocInfo(iface);
            symbolMap.set(name, {
                name,
                kind: "interface",
                signatures: [],
                isDeprecated,
                deprecationNotice,
                jsDocComment
            });
        }
        for (const typeAlias of sourceFile.getTypeAliases()) {
            if (!typeAlias.isExported())
                continue;
            const name = typeAlias.getName();
            const { isDeprecated, deprecationNotice, jsDocComment } = this.extractJsDocInfo(typeAlias);
            symbolMap.set(name, {
                name,
                kind: "typeAlias",
                signatures: [],
                isDeprecated,
                deprecationNotice,
                jsDocComment
            });
        }
        return symbolMap;
    }
    extractFunctionSignatures(fn) {
        const parameters = fn.getParameters().map((param) => ({
            name: param.getName(),
            typeText: param.getType().getText(),
            isOptional: param.isOptional(),
            isRest: param.isRestParameter()
        }));
        return [
            {
                parameters,
                returnTypeText: fn.getReturnType().getText(),
                rawDeclaration: fn.getText()
            }
        ];
    }
    extractVariableSignatures(decl) {
        const type = decl.getType();
        const callSignatures = type.getCallSignatures();
        return callSignatures.map((sig) => {
            const parameters = sig.getParameters().map((param) => {
                const decls = param.getDeclarations();
                const paramDecl = decls[0];
                const isOptional = paramDecl && Node.isParameterDeclaration(paramDecl) ? paramDecl.isOptional() : false;
                const isRest = paramDecl && Node.isParameterDeclaration(paramDecl) ? paramDecl.isRestParameter() : false;
                return {
                    name: param.getName(),
                    typeText: param.getTypeAtLocation(decl).getText(),
                    isOptional,
                    isRest
                };
            });
            return {
                parameters,
                returnTypeText: sig.getReturnType().getText(),
                rawDeclaration: decl.getText()
            };
        });
    }
    extractJsDocInfo(node) {
        if (typeof node.getJsDocs !== "function") {
            return { isDeprecated: false };
        }
        const jsDocs = node.getJsDocs();
        let isDeprecated = false;
        let deprecationNotice;
        let jsDocComment;
        for (const doc of jsDocs) {
            jsDocComment = doc.getInnerText();
            const tags = doc.getTags();
            for (const tag of tags) {
                if (tag.getTagName() === "deprecated") {
                    isDeprecated = true;
                    deprecationNotice = tag.getCommentText() || "Deprecated upstream";
                }
            }
        }
        return { isDeprecated, deprecationNotice, jsDocComment };
    }
}
//# sourceMappingURL=declarationLoader.js.map