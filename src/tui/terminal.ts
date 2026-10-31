import readline from "node:readline";

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

export class TerminalManager {
  private isRaw: boolean = false;
  private keyHandler: KeyHandler | null = null;
  private resizeHandler: ResizeHandler | null = null;
  private boundKeypressListener: ((str: string, key: any) => void) | null = null;
  private boundResizeListener: (() => void) | null = null;
  private cleanupHooksRegistered: boolean = false;

  constructor() {
    this.registerProcessHooks();
  }

  public enterScreen(): void {
    if (process.stdout.isTTY) {
      // Enter alternate screen buffer and hide cursor
      process.stdout.write("\x1b[?1049h\x1b[?25l");
    }

    if (process.stdin.isTTY && !this.isRaw) {
      readline.emitKeypressEvents(process.stdin);
      try {
        process.stdin.setRawMode(true);
        this.isRaw = true;
      } catch {
        // Fallback for non-standard terminals
      }

      this.boundKeypressListener = (_str: string, key: any) => {
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

  public leaveScreen(): void {
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
      } catch {
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

  public getColumns(): number {
    return process.stdout.columns || 80;
  }

  public getRows(): number {
    return process.stdout.rows || 24;
  }

  public write(output: string): void {
    process.stdout.write(output);
  }

  public clear(): void {
    process.stdout.write("\x1b[2J\x1b[H");
  }

  public onKey(handler: KeyHandler): void {
    this.keyHandler = handler;
  }

  public onResize(handler: ResizeHandler): void {
    this.resizeHandler = handler;
  }

  private dispatchKey(event: KeyEvent): void {
    // Intercept standard terminal quit signals
    if (event.ctrl && (event.name === "c" || event.name === "d")) {
      this.leaveScreen();
      process.exit(0);
    }

    if (this.keyHandler) {
      this.keyHandler(event);
    }
  }

  private registerProcessHooks(): void {
    if (this.cleanupHooksRegistered) return;
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

