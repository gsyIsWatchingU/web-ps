import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api/ai": {
        target: "https://ark.cn-beijing.volces.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ai/, "/api/v3")
      }
    },
    middleware: () => {
      return async (req, res, next) => {
        if (req.url?.startsWith("/api/model-proxy")) {
          const url = new URL(req.url, "http://localhost:5173");
          const targetUrl = url.searchParams.get("url");

          if (!targetUrl) {
            res.statusCode = 400;
            res.end("Missing url parameter");
            return;
          }

          console.log(`[Model Proxy] Fetching: ${targetUrl}`);

          try {
            const response = await fetch(targetUrl);
            
            if (!response.ok) {
              console.error(`[Model Proxy] Request failed: ${response.status} ${response.statusText}`);
              res.statusCode = response.status;
              res.end(`Failed to fetch model: ${response.status} ${response.statusText}`);
              return;
            }

            const buffer = await response.arrayBuffer();
            const contentType = response.headers.get("Content-Type") || "application/octet-stream";
            
            console.log(`[Model Proxy] Success - Size: ${buffer.byteLength} bytes, Type: ${contentType}`);

            res.setHeader("Content-Type", contentType);
            res.setHeader("Content-Length", buffer.byteLength);
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
            res.setHeader("Access-Control-Allow-Headers", "*");

            res.statusCode = response.status;
            res.end(Buffer.from(buffer));
          } catch (error) {
            console.error("[Model Proxy] Error:", error);
            res.statusCode = 502;
            res.end(`Failed to fetch model: ${error instanceof Error ? error.message : "Unknown error"}`);
          }
          return;
        }
        next();
      };
    }
  }
});
