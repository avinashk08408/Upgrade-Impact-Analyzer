import http from "node:http";
export interface ServerOptions {
    port?: number;
    projectPath?: string;
    autoOpen?: boolean;
}
export declare function startWebServer(options?: ServerOptions): http.Server;
//# sourceMappingURL=index.d.ts.map