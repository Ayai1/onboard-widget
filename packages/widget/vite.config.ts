import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(packageDir, "src/index.ts"),
      name: "OnboardWidget",
      formats: ["es", "iife"],
      fileName: (format) =>
        format === "iife" ? "onboard-widget.umd.cjs" : "onboard-widget.js",
    },
    rollupOptions: {
      external: ["react", "react-dom"],
      output: {
        globals: { react: "React", "react-dom": "ReactDOM" },
        inlineDynamicImports: true,
      },
    },
  },
});
