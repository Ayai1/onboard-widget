import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    manifest: true,
    lib: {
      entry: resolve(packageDir, "src/index.ts"),
      name: "OnboardWidget",
      formats: ["es"],
      fileName: () => "onboard-widget.js",
    },
    rollupOptions: {
      external: ["react", "react-dom/client", "react/jsx-runtime"],
      output: {
        globals: { react: "React", "react-dom/client": "ReactDOM" },
        chunkFileNames: "chunks/[name]-[hash].js",
      },
    },
  },
});
