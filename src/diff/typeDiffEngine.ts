import type { ExportedSymbolMetadata, BreakingChange } from "../types.js";

export class TypeDiffEngine {
  public diff(
    oldSymbols: Map<string, ExportedSymbolMetadata>,
    newSymbols: Map<string, ExportedSymbolMetadata>
  ): BreakingChange[] {
    const changes: BreakingChange[] = [];

    // 1. Check for removed symbols
    for (const [name, oldSymbol] of oldSymbols.entries()) {
      const newSymbol = newSymbols.get(name);

      if (!newSymbol) {
        changes.push({
          category: "REMOVED_EXPORT",
          symbolName: name,
          severity: "CRITICAL",
          description: `Symbol '${name}' was removed in the target version.`,
          oldSignature: oldSymbol.signatures[0]?.rawDeclaration
        });
        continue;
      }

      // 2. Check for newly introduced deprecations
      if (!oldSymbol.isDeprecated && newSymbol.isDeprecated) {
        changes.push({
          category: "DEPRECATED_MEMBER",
          symbolName: name,
          severity: "WARNING",
          description: `Symbol '${name}' has been deprecated upstream: ${newSymbol.deprecationNotice ?? "No notice provided"}.`,
          oldSignature: oldSymbol.signatures[0]?.rawDeclaration,
          newSignature: newSymbol.signatures[0]?.rawDeclaration
        });
      }

      // 3. Check for function signature breaking changes
      if (oldSymbol.signatures.length > 0 && newSymbol.signatures.length > 0) {
        const oldSig = oldSymbol.signatures[0];
        const newSig = newSymbol.signatures[0];

        // Check required parameters count
        const oldRequiredParams = oldSig.parameters.filter((p) => !p.isOptional && !p.isRest).length;
        const newRequiredParams = newSig.parameters.filter((p) => !p.isOptional && !p.isRest).length;

        if (newRequiredParams > oldRequiredParams) {
          changes.push({
            category: "PARAM_ADDED_REQUIRED",
            symbolName: name,
            severity: "CRITICAL",
            description: `Function '${name}' now requires ${newRequiredParams} arguments (previously required ${oldRequiredParams}).`,
            oldSignature: oldSig.rawDeclaration,
            newSignature: newSig.rawDeclaration
          });
        }

        // Check return type modification
        if (oldSig.returnTypeText !== newSig.returnTypeText && oldSig.returnTypeText !== "any") {
          changes.push({
            category: "RETURN_TYPE_CHANGED",
            symbolName: name,
            severity: "WARNING",
            description: `Return type of '${name}' changed from '${oldSig.returnTypeText}' to '${newSig.returnTypeText}'.`,
            oldSignature: oldSig.rawDeclaration,
            newSignature: newSig.rawDeclaration
          });
        }
      }
    }

    return changes;
  }
}

