import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { handleApiRequest } from "./src/server/apiHandler.js";

function breakcheckDevApiPlugin(): Plugin {
  const attachMiddleware = (middlewares: any) => {
    middlewares.use(async (req: any, res: any, next: any) => {
      const url = req.url || "";
      if (url.startsWith("/api/")) {
        const origin = req.headers.origin || "*";
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.end();
          return;
        }

        try {
          const handled = await handleApiRequest(req as any, res as any, process.cwd());
          if (handled) return;
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err?.message || String(err) }));
          return;
        }
      }
      next();
    });
  };

  return {
    name: "breakcheck-dev-api-middleware",
    configureServer(server) {
      attachMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      attachMiddleware(server.middlewares);
    }
  };
}

export default defineConfig({
  plugins: [react(), breakcheckDevApiPlugin()],
  build: {
    emptyOutDir: false,
    outDir: "dist"
  },
  server: {
    port: 3000,
    host: "127.0.0.1",
    cors: true,
    open: true
  },
  preview: {
    port: 3000,
    host: "127.0.0.1",
    cors: true
  }
});
