import type { Ecosystem } from "../multilang/manifestParsers.js";
import type { CliffFinding } from "../cliff/scanner.js";
import type { ImpactReportItem, ScanScopeLimitations } from "../types.js";
export type CorrelatedImpactItem = ImpactReportItem;
export type TuiTab = "dependencies" | "cliffs";
export type TuiViewMode = "list" | "detail" | "confirm_fix" | "help";
export type DependencyStatus = "up_to_date" | "upgrade_available" | "error" | "loading" | "undetermined";
export interface DependencyItem {
    id: string;
    name: string;
    currentVersion: string;
    requestedRange?: string;
    isLockfileResolved: boolean;
    isRangeOnly: boolean;
    ecosystem: Ecosystem;
    language: string;
    manifestFile: string;
    latestVersion: string;
    releaseDate: string;
    status: DependencyStatus;
    errorMessage?: string;
}
export interface PackageAnalysisState {
    id: string;
    packageName: string;
    ecosystem: Ecosystem;
    targetVersion: string;
    fromVersion: string;
    loading: boolean;
    error?: string;
    totalUpstreamChanges: number;
    affectedUsagesCount: number;
    localUsagesCount: number;
    items: ImpactReportItem[];
    isNonNpmAudit: boolean;
    scanScope?: ScanScopeLimitations;
}
export interface TuiState {
    projectPath: string;
    projectName: string;
    activeTab: TuiTab;
    viewMode: TuiViewMode;
    selectedDepIndex: number;
    selectedCliffIndex: number;
    depScrollOffset: number;
    cliffScrollOffset: number;
    detailScrollOffset: number;
    searchQuery: string;
    isSearching: boolean;
    dependencies: DependencyItem[];
    cliffFindings: CliffFinding[];
    analyses: Record<string, PackageAnalysisState>;
    pendingFix?: {
        item: ImpactReportItem;
        packageId: string;
        packageName: string;
        itemIndex: number;
    };
    statusMessage?: string;
    isLoadingDeps: boolean;
    isLoadingCliffs: boolean;
    cliffError?: string;
}
//# sourceMappingURL=types.d.ts.map