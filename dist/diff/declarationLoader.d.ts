import type { ExportedSymbolMetadata } from "../types.js";
export declare class DeclarationLoader {
    private project;
    constructor();
    parseDeclarations(sourceCode: string, virtualPath?: string): Map<string, ExportedSymbolMetadata>;
    private extractExportedSymbols;
    private extractFunctionSignatures;
    private extractVariableSignatures;
    private extractJsDocInfo;
}
//# sourceMappingURL=declarationLoader.d.ts.map