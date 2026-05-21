import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { Readable } from "node:stream";

function assetProxyPlugin() {
  return {
    name: "asset-proxy",
    configureServer(server: {
      middlewares: {
        use: (
          path: string,
          handler: (req: { url?: string }, res: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body?: string) => void }, next: () => void) => void | Promise<void>
        ) => void;
      };
    }) {
      server.middlewares.use("/api/asset-proxy", async (req, res, next) => {
        const requestUrl = new URL(req.url || "", "http://localhost");
        const targetUrl = requestUrl.searchParams.get("url");

        if (!targetUrl) {
          res.statusCode = 400;
          res.end("Missing url query parameter.");
          return;
        }

        try {
          const upstream = await fetch(targetUrl);

          if (!upstream.ok || !upstream.body) {
            res.statusCode = upstream.status;
            res.end(await upstream.text());
            return;
          }

          res.statusCode = 200;
          const contentType = upstream.headers.get("content-type");
          const cacheControl = upstream.headers.get("cache-control");

          if (contentType) {
            res.setHeader("Content-Type", contentType);
          }

          if (cacheControl) {
            res.setHeader("Cache-Control", cacheControl);
          }

          res.setHeader("Access-Control-Allow-Origin", "*");
          Readable.fromWeb(upstream.body as never).pipe(res as never);
        } catch (error) {
          res.statusCode = 502;
          res.end(error instanceof Error ? error.message : "Failed to proxy asset.");
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), assetProxyPlugin()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api/ai": {
        target: "https://ark.cn-beijing.volces.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ai/, "/api/v3")
      }
    }
  }
});
