import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = JSON.parse(
  await readFile(join(repositoryRoot, "font-source.json"), "utf8"),
);

await verifyJavaScriptEntry();
await verifyLicenses();

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

async function verifyJavaScriptEntry() {
  const manifest = JSON.parse(
    await readFile(join(repositoryRoot, "package.json"), "utf8"),
  );
  const rootExport = manifest.exports?.["."];

  if (
    rootExport?.types !== "./index.d.ts" ||
    rootExport?.import !== "./index.js" ||
    rootExport?.default !== "./index.js" ||
    manifest.exports?.["./index.css"] !== "./index.css"
  ) {
    throw new Error(
      "package.json does not expose the JavaScript and CSS entries correctly.",
    );
  }

  const [javascript, stylesheet, declarations] = await Promise.all([
    readFile(join(repositoryRoot, "index.js"), "utf8"),
    readFile(join(repositoryRoot, "index.css"), "utf8"),
    readFile(join(repositoryRoot, "index.d.ts"), "utf8"),
  ]);

  if (!javascript.includes('import "./index.css"')) {
    throw new Error("The JavaScript entry does not load its stylesheet.");
  }
  for (const variant of source.variants) {
    const exportName = `./${variant.name}.css`;
    const exportTarget = `./fonts/${variant.name}/index.css`;

    if (manifest.exports?.[exportName] !== exportTarget) {
      throw new Error(
        `package.json does not expose ${variant.name} at ${exportName}.`,
      );
    }
    if (!stylesheet.includes(`@import "./fonts/${variant.name}/index.css"`)) {
      throw new Error(
        `The main stylesheet does not load the ${variant.name} font faces.`,
      );
    }
  }
  for (const property of ["className", "variable", "style"]) {
    if (!javascript.includes(`${property}:`) || !declarations.includes(property)) {
      throw new Error(`The JavaScript entry does not expose ${property}.`);
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
