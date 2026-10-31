export interface ConsumerUsage {
  filePath: string;
  line: number;
  column: number;
  identifierName: string;
  sourceSnippet: string;
  argumentCount?: number;
  isCallExpression: boolean;
}

export interface ParameterMetadata {
  name: string;
  typeText: string;
  isOptional: boolean;
  isRest: boolean;
}

export interface SignatureMetadata {
  parameters: ParameterMetadata[];
  returnTypeText: string;
  rawDeclaration: string;
}

export interface ExportedSymbolMetadata {
  name: string;
  kind: "function" | "class" | "interface" | "typeAlias" | "variable";
  signatures: SignatureMetadata[];
  isDeprecated: boolean;
  deprecationNotice?: string;
  jsDocComment?: string;
}

export type BreakingChangeSeverity = "CRITICAL" | "WARNING" | "INFO";

export type BreakingChangeCategory =
  | "REMOVED_EXPORT"
  | "PARAM_ADDED_REQUIRED"
  | "PARAM_TYPE_MUTATED"
  | "RETURN_TYPE_CHANGED"
  | "DEPRECATED_MEMBER"
  | "USAGE_AUDIT";

export interface BreakingChange {
  category: BreakingChangeCategory;
  symbolName: string;
  severity: BreakingChangeSeverity;
  description: string;
  oldSignature?: string;
  newSignature?: string;
}

export interface RemediationPlan {
  beforeCode: string;
  afterCode: string;
  explanation: string;
  isAutoFixable: boolean;
}

export interface EvidenceSource {
  title: string;
  url?: string;
  notes?: string;
}

export interface ImpactReportItem {
  usage: ConsumerUsage;
  breakingChange: BreakingChange;
  upstreamRationale: string;
  runtimeRisk: string;
  remediation: RemediationPlan;
  evidence?: EvidenceSource[];
}

export interface ScanScopeLimitations {
  checkedVersions: {
    base: string;
    target: string;
  };
  inspectedFileCount: number;
  uninspectedPatterns: string[];
  disclaimer: string;
}

export interface AnalysisSummary {
  packageName: string;
  currentVersion: string;
  targetVersion: string;
  totalUpstreamChanges: number;
  affectedUsagesCount: number;
  riskScore: number;
  items: ImpactReportItem[];
  scanScope?: ScanScopeLimitations;
}
