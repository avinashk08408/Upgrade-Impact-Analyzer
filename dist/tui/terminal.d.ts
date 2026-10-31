export interface KeyEvent {
    name: string;
    ctrl: boolean;
    shift: boolean;
    meta: boolean;
    sequence: string;
    char?: string;
}
export type KeyHandler = (key: KeyEvent) => void;
export type ResizeHandler = (columns: number, rows: number) => void;
export declare class TerminalManager {
    private isRaw;
    private keyHandler;
    private resizeHandler;
    private boundKeypressListener;
    private boundResizeListener;
    private cleanupHooksRegistered;
    constructor();
    enterScreen(): void;
    leaveScreen(): void;
    getColumns(): number;
    getRows(): number;
    write(output: string): void;
    clear(): void;
    onKey(handler: KeyHandler): void;
    onResize(handler: ResizeHandler): void;
    private dispatchKey;
    private registerProcessHooks;
}
//# sourceMappingURL=terminal.d.ts.map