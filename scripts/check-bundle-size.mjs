import { readdir, readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(
  new URL("../packages/widget/dist/", import.meta.url),
);
const budgetValue = Number(process.env.BUNDLE_GZIP_BUDGET_KB ?? "80");

if (!Number.isFinite(budgetValue) || budgetValue <= 0) {
  throw new Error("BUNDLE_GZIP_BUDGET_KB must be a positive number.");
}

const files = await collectJavaScriptFiles(dist);
if (!files.length)
  throw new Error(
    "No built JavaScript bundles were found. Run npm run build first.",
  );

const entryFiles = new Set(["onboard-widget.js", "onboard-widget.umd.js"]);
const manifest = JSON.parse(
  await readFile(join(dist, ".vite", "manifest.json"), "utf8"),
);
const esmEntry = Object.values(manifest).find(
  (entry) => entry.isEntry && entry.src === "src/index.ts",
);
if (!esmEntry)
  throw new Error("The ESM widget entry was not found in the Vite manifest.");

const startupFiles = collectStaticImports(esmEntry, manifest);
const gzipSizes = new Map();
let failed = false;

for (const file of files) {
  const name = relative(dist, file).replaceAll("\\", "/");
  if (name === "onboard-widget.umd.cjs") continue;
  const gzipKb = gzipSync(await readFile(file)).byteLength / 1024;
  gzipSizes.set(name, gzipKb);
  const kind = entryFiles.has(name)
    ? "main"
    : startupFiles.has(name)
      ? "startup chunk"
      : "lazy chunk";
  process.stdout.write(`${kind}: ${name} ${gzipKb.toFixed(2)} KB gzip\n`);
}

const esmStartupKb = [...startupFiles].reduce(
  (sum, file) => sum + (gzipSizes.get(file) ?? 0),
  0,
);
const umdKb = gzipSizes.get("onboard-widget.umd.js") ?? 0;
process.stdout.write(
  `ESM startup total: ${esmStartupKb.toFixed(2)} KB gzip (budget ${budgetValue} KB)\n`,
);
process.stdout.write(
  `UMD bundle: ${umdKb.toFixed(2)} KB gzip (budget ${budgetValue} KB)\n`,
);
if (esmStartupKb > budgetValue || umdKb > budgetValue) failed = true;
if (failed) process.exitCode = 1;

async function collectJavaScriptFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory())
      files.push(...(await collectJavaScriptFiles(path)));
    else if (/\.(?:js|mjs|cjs)$/.test(entry.name)) files.push(path);
  }
  return files;
}

function collectStaticImports(entry, manifest, files = new Set()) {
  if (files.has(entry.file)) return files;
  files.add(entry.file);
  for (const importKey of entry.imports ?? []) {
    const imported = manifest[importKey];
    if (imported) collectStaticImports(imported, manifest, files);
  }
  return files;
}
