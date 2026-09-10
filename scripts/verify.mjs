import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = JSON.parse(
  await readFile(join(repositoryRoot, "font-source.json"), "utf8"),
);
const assets = JSON.parse(
  await readFile(join(repositoryRoot, "font-assets.json"), "utf8"),
);

await verifyPackageContract();
await verifyLicenses();
await verifyAssetManifest();

let totalFontFiles = 0;
let totalFontBytes = 0;

for (const variant of source.variants) {
  const variantDirectory = join(repositoryRoot, "fonts", variant.name);
  const cssPath = join(variantDirectory, "index.css");
  const css = await readFile(cssPath, "utf8");
  const referencedFiles = [
    ...css.matchAll(/url\(["']?\.\/([^"')]+\.woff2)["']?\)/g),
  ].map((match) => match[1]);

  if (referencedFiles.length === 0) {
    throw new Error(`${variant.name} CSS does not reference any WOFF2 files.`);
  }
  if (!css.includes(`font-family:${JSON.stringify(source.family)}`)) {
    throw new Error(`${variant.name} CSS has the wrong font family.`);
  }
  if (!css.includes(`font-weight:${variant.weight}`)) {
    throw new Error(`${variant.name} CSS has the wrong font weight.`);
  }
  if (!css.includes("unicode-range:")) {
    throw new Error(`${variant.name} CSS does not contain Unicode ranges.`);
  }
  if (css.includes('url("/')) {
    throw new Error(`${variant.name} CSS contains an absolute asset URL.`);
  }

  const fontFiles = (await readdir(variantDirectory)).filter((file) =>
    file.endsWith(".woff2"),
  );
  const uniqueReferences = new Set(referencedFiles);
  if (
    uniqueReferences.size !== referencedFiles.length ||
    uniqueReferences.size !== fontFiles.length
  ) {
    throw new Error(
      `${variant.name} has ${fontFiles.length} files but ${uniqueReferences.size} unique CSS references.`,
    );
  }

  for (const file of uniqueReferences) {
    const fileStats = await stat(join(variantDirectory, file));
    totalFontBytes += fileStats.size;
  }
  totalFontFiles += fontFiles.length;
}

console.log(
  `Verified ${totalFontFiles} WOFF2 files (${formatBytes(totalFontBytes)}) for ${source.family} ${source.version}.`,
);

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

async function verifyPackageContract() {
  const manifest = JSON.parse(
    await readFile(join(repositoryRoot, "package.json"), "utf8"),
  );
  const rootExport = manifest.exports?.["."];
  const configExport = manifest.exports?.["./config"];
  const nextExport = manifest.exports?.["./next"];
  const nextConfigExport = manifest.exports?.["./next/config"];

  if (
    rootExport?.types !== "./index.d.ts" ||
    rootExport?.import !== "./index.js" ||
    rootExport?.default !== "./index.js"
  ) {
    throw new Error("package.json does not expose the JavaScript entry correctly.");
  }
  if (
    configExport?.types !== "./config.d.ts" ||
    configExport?.import !== "./config.js" ||
    configExport?.default !== "./config.js"
  ) {
    throw new Error("package.json does not expose the config entry correctly.");
  }
  if (
    nextExport?.types !== "./next.d.ts" ||
    nextExport?.import !== "./next.js" ||
    nextExport?.default !== "./next.js"
  ) {
    throw new Error("package.json does not expose the Next.js font entry correctly.");
  }
  if (
    nextConfigExport?.types !== "./next-config.d.ts" ||
    nextConfigExport?.import !== "./next-config.js" ||
    nextConfigExport?.default !== "./next-config.js"
  ) {
    throw new Error("package.json does not expose the Next.js config entry correctly.");
  }
  if (manifest.bin?.["sarasa-gothic-webfont"] !== "./cli.js") {
    throw new Error("package.json does not expose the prepare CLI correctly.");
  }

  const [
    javascript,
    declarations,
    config,
    configDeclarations,
    next,
    nextDeclarations,
    nextConfig,
    nextConfigDeclarations,
    cli,
  ] =
    await Promise.all([
      readFile(join(repositoryRoot, "index.js"), "utf8"),
      readFile(join(repositoryRoot, "index.d.ts"), "utf8"),
      readFile(join(repositoryRoot, "config.js"), "utf8"),
      readFile(join(repositoryRoot, "config.d.ts"), "utf8"),
      readFile(join(repositoryRoot, "next.js"), "utf8"),
      readFile(join(repositoryRoot, "next.d.ts"), "utf8"),
      readFile(join(repositoryRoot, "next-config.js"), "utf8"),
      readFile(join(repositoryRoot, "next-config.d.ts"), "utf8"),
      readFile(join(repositoryRoot, "cli.js"), "utf8"),
    ]);

  if (javascript.includes(".css")) {
    throw new Error("The JavaScript entry must not bundle generated font CSS.");
  }
  if (
    !config.includes("defineConfig") ||
    !configDeclarations.includes("defineConfig")
  ) {
    throw new Error("The config entry does not expose defineConfig().");
  }
  if (
    !next.includes("@sarasa-gothic-webfont/generated") ||
    !next.includes("Sarasa_UI_SC") ||
    !nextDeclarations.includes("Sarasa_UI_SC")
  ) {
    throw new Error("The Next.js font entry does not load CSS and expose Sarasa_UI_SC().");
  }
  if (
    !nextConfig.includes("withSarasa") ||
    !nextConfigDeclarations.includes("withSarasa")
  ) {
    throw new Error("The Next.js config entry does not expose withSarasa().");
  }
  if (!cli.startsWith("#!/usr/bin/env node") || !cli.includes("prepare")) {
    throw new Error("The CLI is missing its executable header or prepare command.");
  }
  for (const property of ["className", "variable", "style"]) {
    if (!javascript.includes(`${property}:`) || !declarations.includes(property)) {
      throw new Error(`The JavaScript entry does not expose ${property}.`);
    }
  }

  const requiredFiles = [
    "index.d.ts",
    "index.js",
    "config.d.ts",
    "config.js",
    "next.d.ts",
    "next.js",
    "next-config.d.ts",
    "next-config.js",
    "cli.js",
    "lib/",
    "font-assets.json",
  ];
  for (const file of requiredFiles) {
    if (!manifest.files?.includes(file)) {
      throw new Error(`package.json does not include ${file} in published files.`);
    }
  }
  if (manifest.files.some((file) => file === "fonts/" || file.endsWith(".css"))) {
    throw new Error("package.json must not publish generated font files or CSS.");
  }
}

async function verifyAssetManifest() {
  if (assets.schemaVersion !== 1) {
    throw new Error("font-assets.json has an unsupported schemaVersion.");
  }
  const family = assets.families?.[source.id];
  if (!family || family.fontFamily !== source.family || family.version !== source.version) {
    throw new Error("font-assets.json does not match font-source.json.");
  }
  if (
    !assets.baseUrl.startsWith(
      "https://github.com/haytham818/sarasa-gothic-webfont/releases/download/",
    )
  ) {
    throw new Error("font-assets.json must use this repository's GitHub Release assets.");
  }

  for (const variant of source.variants) {
    const asset = family.variants?.[String(variant.weight)];
    if (
      !asset ||
      asset.name !== variant.name ||
      asset.weight !== variant.weight ||
      !/^sarasa-ui-sc-\d+\.tar\.gz$/.test(asset.archive) ||
      !/^[a-f0-9]{64}$/.test(asset.sha256) ||
      !Number.isSafeInteger(asset.size) ||
      asset.size <= 0
    ) {
      throw new Error(
        `font-assets.json has invalid metadata for ${variant.name} (${variant.weight}).`,
      );
    }
    const fontFiles = (
      await readdir(join(repositoryRoot, "fonts", variant.name))
    ).filter((file) => file.endsWith(".woff2"));
    if (asset.fontFiles !== fontFiles.length) {
      throw new Error(
        `font-assets.json expects ${asset.fontFiles} files for ${variant.name}, but the repository contains ${fontFiles.length}.`,
      );
    }
  }
}

async function verifyLicenses() {
  const manifest = JSON.parse(
    await readFile(join(repositoryRoot, "package.json"), "utf8"),
  );
  const licenseFiles = ["LICENSE", "LICENSE-MIT.txt", "LICENSE-OFL.txt"];

  if (manifest.license !== "MIT AND OFL-1.1") {
    throw new Error(
      "package.json must declare both the MIT and OFL-1.1 licenses.",
    );
  }

  for (const file of licenseFiles) {
    if (!manifest.files?.includes(file)) {
      throw new Error(`package.json does not include ${file} in published files.`);
    }
    await readFile(join(repositoryRoot, file), "utf8");
  }
}
