import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
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
});
