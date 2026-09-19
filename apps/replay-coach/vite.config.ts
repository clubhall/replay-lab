import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { api } from "./server/api";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "coach-local-api",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          void api(req, res, next);
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          void api(req, res, next);
        });
      },
    },
  ],
});
