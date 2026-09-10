import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = JSON.parse(
  await readFile(join(repositoryRoot, "font-source.json"), "utf8"),
);

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
