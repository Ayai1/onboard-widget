import { copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(
  new URL("../dist/onboard-widget.umd.js", import.meta.url),
);
const target = fileURLToPath(
  new URL("../dist/onboard-widget.umd.cjs", import.meta.url),
);
await copyFile(source, target);
