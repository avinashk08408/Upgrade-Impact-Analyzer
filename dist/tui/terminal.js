import readline from "node:readline";
export class TerminalManager {
    isRaw = false;
    keyHandler = null;
    resizeHandler = null;
    boundKeypressListener = null;
    boundResizeListener = null;
    cleanupHooksRegistered = false;
    constructor() {
        this.registerProcessHooks();
    }
    enterScreen() {
        if (process.stdout.isTTY) {
            // Enter alternate screen buffer and hide cursor
            process.stdout.write("\x1b[?1049h\x1b[?25l");
        }
        if (process.stdin.isTTY && !this.isRaw) {
            readline.emitKeypressEvents(process.stdin);
            try {
                process.stdin.setRawMode(true);
                this.isRaw = true;
            }
            catch {
                // Fallback for non-standard terminals
            }
            this.boundKeypressListener = (_str, key) => {
                if (!key) {
                    if (_str) {
                        this.dispatchKey({
                            name: _str,
                            ctrl: false,
                            shift: false,
                            meta: false,
                            sequence: _str,
                            char: _str
                        });
                    }
                    return;
                }
                this.dispatchKey({
                    name: key.name || "",
                    ctrl: !!key.ctrl,
                    shift: !!key.shift,
                    meta: !!key.meta,
                    sequence: key.sequence || "",
                    char: key.name && key.name.length === 1 ? key.name : (_str || undefined)
                });
            };
            process.stdin.on("keypress", this.boundKeypressListener);
            process.stdin.resume();
        }
        if (process.stdout.isTTY) {
            this.boundResizeListener = () => {
                if (this.resizeHandler) {
                    this.resizeHandler(this.getColumns(), this.getRows());
                }
            };
            process.stdout.on("resize", this.boundResizeListener);
        }
    }
    leaveScreen() {
        if (this.boundKeypressListener) {
            process.stdin.removeListener("keypress", this.boundKeypressListener);
            this.boundKeypressListener = null;
        }
        if (this.boundResizeListener) {
            process.stdout.removeListener("resize", this.boundResizeListener);
            this.boundResizeListener = null;
        }
        if (this.isRaw && process.stdin.isTTY) {
            try {
                process.stdin.setRawMode(false);
            }
            catch {
                // Ignore
            }
            process.stdin.pause();
            this.isRaw = false;
        }
        if (process.stdout.isTTY) {
            // Leave alternate screen buffer, show cursor, clear attributes
            process.stdout.write("\x1b[0m\x1b[?1049l\x1b[?25h");
        }
    }
    getColumns() {
        return process.stdout.columns || 80;
    }
    getRows() {
        return process.stdout.rows || 24;
    }
    write(output) {
        process.stdout.write(output);
    }
    clear() {
        process.stdout.write("\x1b[2J\x1b[H");
    }
    onKey(handler) {
        this.keyHandler = handler;
    }
    onResize(handler) {
        this.resizeHandler = handler;
    }
    dispatchKey(event) {
        // Intercept standard terminal quit signals
        if (event.ctrl && (event.name === "c" || event.name === "d")) {
            this.leaveScreen();
            process.exit(0);
        }
        if (this.keyHandler) {
            this.keyHandler(event);
        }
    }
    registerProcessHooks() {
        if (this.cleanupHooksRegistered)
            return;
        this.cleanupHooksRegistered = true;
        const cleanup = () => {
            this.leaveScreen();
        };
        process.on("exit", cleanup);
        process.on("SIGINT", () => {
            cleanup();
            process.exit(0);
        });
        process.on("SIGTERM", () => {
            cleanup();
            process.exit(0);
        });
        process.on("uncaughtException", (err) => {
            cleanup();
            console.error("[BreakCheck Fatal Error]", err);
            process.exit(1);
        });
    }
}
//# sourceMappingURL=terminal.js.map