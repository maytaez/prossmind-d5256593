import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  envDir: path.resolve(__dirname, "../.."), // Read .env from root directory
  server: {
    host: "::",
    port: 8082,
  },
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@",
        replacement: path.resolve(__dirname, "./src"),
      },
      {
        find: "@prossmind/shared",
        replacement: path.resolve(__dirname, "../../packages/shared/src"),
      },
      {
        find: /^@prossmind\/ui\/(.+)$/,
        replacement: path.resolve(__dirname, "../../packages/ui/src/ui/$1"),
      },
      {
        find: "@prossmind/ui",
        replacement: path.resolve(__dirname, "../../packages/ui/src"),
      },
    ],
    conditions: ["import", "module", "browser", "default"],
  },
  optimizeDeps: {
    include: ["@prossmind/ui", "@prossmind/shared"],
  },
});

