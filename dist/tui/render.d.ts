import type { TuiState, DependencyItem } from "./types.js";
export declare function getFilteredDependencies(state: TuiState): DependencyItem[];
export declare function renderTui(state: TuiState, columns: number, rows: number): string;
export declare function renderDependencyListView(state: TuiState, columns: number, maxLines: number): string[];
export declare function renderDependencyDetailView(state: TuiState, columns: number, maxLines: number): string[];
export declare function renderCliffListView(state: TuiState, columns: number, maxLines: number): string[];
export declare function renderCliffDetailView(state: TuiState, columns: number, maxLines: number): string[];
export declare function renderConfirmFixView(state: TuiState, columns: number, maxLines: number): string[];
export declare function renderHelpView(columns: number, maxLines: number): string[];
export declare function renderFooterBar(state: TuiState): string;
//# sourceMappingURL=render.d.ts.map