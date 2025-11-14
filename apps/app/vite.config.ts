import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  envDir: path.resolve(__dirname, "../.."), // Read .env from root directory
  server: {
    host: "::",
    port: 8081,
  },
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@",
        replacement: path.resolve(__dirname, "./src"),
      },
      // Explicit mappings for known directory exports
      {
        find: "@prossmind/shared/context",
        replacement: path.resolve(__dirname, "../../packages/shared/src/context/index.ts"),
      },
      {
        find: "@prossmind/shared/components",
        replacement: path.resolve(__dirname, "../../packages/shared/src/components/index.ts"),
      },
      {
        find: "@prossmind/shared/hooks",
        replacement: path.resolve(__dirname, "../../packages/shared/src/hooks/index.ts"),
      },
      {
        find: "@prossmind/shared/utils",
        replacement: path.resolve(__dirname, "../../packages/shared/src/utils/index.ts"),
      },
      {
        find: "@prossmind/shared/types",
        replacement: path.resolve(__dirname, "../../packages/shared/src/types/index.ts"),
      },
      {
        find: "@prossmind/shared/config",
        replacement: path.resolve(__dirname, "../../packages/shared/src/config/index.ts"),
      },
      // Generic pattern for other subpaths
      {
        find: /^@prossmind\/shared\/(.+)$/,
        replacement: path.resolve(__dirname, "../../packages/shared/src/$1"),
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

