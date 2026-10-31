import { type KeyEvent } from "./terminal.js";
import type { TuiState } from "./types.js";
export declare class TuiApp {
    private terminal;
    private state;
    private isRunning;
    constructor(projectPath?: string);
    start(): Promise<void>;
    stop(): void;
    getState(): Readonly<TuiState>;
    draw(): void;
    scanDependencies(): Promise<void>;
    scanCliffs(): Promise<void>;
    inspectSelectedDependency(): Promise<void>;
    handleKey(key: KeyEvent): Promise<void>;
    private applyPendingFix;
}
//# sourceMappingURL=app.d.ts.map