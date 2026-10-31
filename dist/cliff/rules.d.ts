export type ServiceMechanismType = "SLEEPING_WEB_SERVER" | "PAUSING_DATABASE" | "SCALE_TO_ZERO_DATABASE" | "EXPIRING_SERVICE_OR_DATA";
export interface WakeBehavior {
    mechanismType: ServiceMechanismType;
    mechanismLabel: string;
    wakesOnNextRequest: boolean;
    requiresManualResumption: boolean;
    firstRequestLatency: string;
    explanation: string;
    breakcheckDisclaimer: string;
}
export interface BackupSpecification {
    whatIsBackedUp: string;
    whatIsNotBackedUp: string;
    storageLocation: string;
    retentionPeriod: string;
    restoreInstructions: string;
    cacheDisclaimer?: string;
}
export interface AlternativePlatform {
    name: string;
    category: "Relational Database" | "Document Database" | "Web Container / Hosting" | "Serverless Platform" | "Cache / KV";
    freeTierLimits: string;
    freeTierHighlight?: string;
    advantageOverCurrent: string;
    migrationEffort: "ZERO_CODE_CHANGE" | "MINOR_CONFIG_CHANGE" | "CODE_OR_DIALECT_MIGRATION";
    migrationDetails: string;
    officialSourceUrl: string;
    dateVerified: string;
}
export interface AutomatedProtection {
    type: "KEEP_ALIVE" | "AUTOMATED_BACKUP" | "WAKE_ALERT";
    title: string;
    description: string;
    actionableSnippet: string;
    status: "COPYABLE_TEMPLATE";
    statusNotice: string;
    targetFilePath?: string;
    requiredConfiguration?: Record<string, string>;
}
export interface CliffRule {
    id: string;
    provider: string;
    service: string;
    plan: string;
    triggerCondition: string;
    timeToFailure: string;
    impactDescription: string;
    applicabilityNote: string;
    detectionPatterns: {
        files?: string[];
        dependencies?: string[];
        envVariables?: string[];
        contentMatches?: string[];
        negativeContentMatches?: string[];
    };
    recommendedFix: {
        summary: string;
        actionableSnippet?: string;
        documentationUrl: string;
    };
    wakeBehavior: WakeBehavior;
    backupSpecification?: BackupSpecification;
    alternativePlatforms?: AlternativePlatform[];
    automatedProtections?: AutomatedProtection[];
}
export declare const DEFAULT_CLIFF_RULES: CliffRule[];
//# sourceMappingURL=rules.d.ts.map