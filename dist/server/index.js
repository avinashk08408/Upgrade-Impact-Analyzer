import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";
import pc from "picocolors";
import { handleApiRequest } from "./apiHandler.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRootDir = path.resolve(__dirname, "../..");
const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2"
};
export function startWebServer(options = {}) {
    const port = options.port || 3456;
    const projectPath = path.resolve(options.projectPath || process.cwd());
    const host = "127.0.0.1";
    const distDir = path.join(packageRootDir, "dist");
    const server = http.createServer(async (req, res) => {
        const origin = req.headers.origin || "";
        // Allow local loopback origins, VS Code webview, and null
        if (!origin ||
            origin === "null" ||
            origin.startsWith("http://localhost:") ||
            origin.startsWith("http://127.0.0.1:") ||
            origin.startsWith("vscode-webview:")) {
            res.setHeader("Access-Control-Allow-Origin", origin || "*");
            res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        }
        if (req.method === "OPTIONS") {
            res.writeHead(204);
            res.end();
            return;
        }
        // Try handling /api/* requests
        const handled = await handleApiRequest(req, res, projectPath);
        if (handled)
            return;
        const parsedUrl = new URL(req.url || "/", "http://127.0.0.1");
        const pathname = parsedUrl.pathname;
        // Serve static assets from BreakCheck's built dist directory
        if (pathname !== "/" && pathname !== "/index.html") {
            const sanitizedRelPath = pathname.replace(/^\/+/, "");
            const candidateAssetPath = path.resolve(distDir, sanitizedRelPath);
            if (candidateAssetPath.startsWith(distDir)) {
                try {
                    const stat = await fs.stat(candidateAssetPath);
                    if (stat.isFile()) {
                        const ext = path.extname(candidateAssetPath).toLowerCase();
                        const contentType = MIME_TYPES[ext] || "application/octet-stream";
                        const content = await fs.readFile(candidateAssetPath);
                        res.writeHead(200, { "Content-Type": contentType });
                        res.end(content);
                        return;
                    }
                }
                catch {
                    // File not found in dist, continue to SPA fallback
                }
            }
        }
        // Static HTML fallback (SPA entrypoint)
        try {
            const distHtml = path.join(distDir, "index.html");
            const rootHtml = path.join(packageRootDir, "index.html");
            let htmlPath = rootHtml;
            try {
                await fs.access(distHtml);
                htmlPath = distHtml;
            }
            catch {
                // Fall back to package root index.html
            }
            const htmlContent = await fs.readFile(htmlPath, "utf-8");
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(htmlContent);
        }
        catch {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("404 Not Found");
        }
    });
    server.listen(port, host, () => {
        const urlStr = `http://${host}:${port}`;
        console.log();
        console.log(pc.bold(`[BREAKCHECK SERVER] Active on: ${pc.cyan(urlStr)}`));
        console.log(`Security: Bound to loopback (${host}) | Restricted to project: ${projectPath}`);
        console.log(`Press Ctrl+C to stop.`);
        console.log();
        if (options.autoOpen === true) {
            const openCmd = process.platform === "win32"
                ? `start ${urlStr}`
                : process.platform === "darwin"
                    ? `open ${urlStr}`
                    : `xdg-open ${urlStr}`;
            exec(openCmd, () => { });
        }
    });
    return server;
}
//# sourceMappingURL=index.js.map