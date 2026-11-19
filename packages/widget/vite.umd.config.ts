import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    manifest: false,
    lib: {
      entry: resolve(packageDir, "src/index.ts"),
      name: "OnboardWidget",
      formats: ["umd"],
      fileName: () => "onboard-widget.umd.js",
    },
    rollupOptions: {
      external: ["react", "react-dom/client"],
      output: {
        globals: { react: "React", "react-dom/client": "ReactDOM" },
        inlineDynamicImports: true,
      },
    },
  },
});
