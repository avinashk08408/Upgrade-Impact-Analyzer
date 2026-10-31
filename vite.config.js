import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { handleApiRequest } from "./src/server/apiHandler.ts";

function breakcheckApiPlugin() {
  return {
    name: "breakcheck-api-middleware",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith("/api/")) {
          try {
            const handled = await handleApiRequest(req, res, process.cwd());
            if (handled) return;
          } catch (err) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: String(err) }));
            return;
          }
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), breakcheckApiPlugin()],
  server: {
    port: 3000,
    open: true
  }
});
