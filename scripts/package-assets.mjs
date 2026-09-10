import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { createGzip } from "node:zlib";
import tar from "tar-stream";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = JSON.parse(
  await readFile(join(repositoryRoot, "font-source.json"), "utf8"),
);
const outputDirectory = join(repositoryRoot, "dist", "font-assets");
const releaseTag = `font-assets-${source.version}`;
const baseUrl = `https://github.com/haytham818/sarasa-gothic-webfont/releases/download/${releaseTag}`;

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

const variants = {};
for (const variant of source.variants) {
  const archiveName = `sarasa-${source.id}-${variant.weight}.tar.gz`;
  const archivePath = join(outputDirectory, archiveName);
  const inputDirectory = join(repositoryRoot, "fonts", variant.name);
  const files = (await readdir(inputDirectory))
    .filter((file) => file === "index.css" || file.endsWith(".woff2"))
    .sort();

  await createArchive({ archivePath, inputDirectory, files });
  const archive = await readFile(archivePath);
  variants[String(variant.weight)] = {
    name: variant.name,
    weight: variant.weight,
    archive: archiveName,
    sha256: createHash("sha256").update(archive).digest("hex"),
    size: archive.length,
    fontFiles: files.filter((file) => file.endsWith(".woff2")).length,
  };
  console.log(`Packaged ${source.id} weight ${variant.weight}.`);
}

const manifest = {
  schemaVersion: 1,
  baseUrl,
  families: {
    [source.id]: {
      fontFamily: source.family,
      version: source.version,
      className: "sarasa-ui-sc-font",
      variable: "sarasa-ui-sc-variable",
      cssVariable: "--font-sarasa-ui-sc",
      fontStack:
        '"Sarasa UI SC", "PingFang SC", "Microsoft YaHei", sans-serif',
      variants,
    },
  },
};

const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
await Promise.all([
  writeFile(join(repositoryRoot, "font-assets.json"), manifestText),
  writeFile(join(outputDirectory, "font-assets.json"), manifestText),
]);

console.log(`Created font assets for ${source.family} ${source.version}.`);

async function createArchive({ archivePath, inputDirectory, files }) {
  const pack = tar.pack();
  const archivePipeline = pipeline(
    pack,
    createGzip({ level: 9, mtime: 0 }),
    createWriteStream(archivePath),
  );

  for (const file of files) {
    const filePath = join(inputDirectory, file);
    const fileStats = await stat(filePath);
    await addEntry(pack, {
      name: file,
      path: filePath,
      size: fileStats.size,
    });
  }

  const licensePath = join(repositoryRoot, "LICENSE-OFL.txt");
  const licenseStats = await stat(licensePath);
  await addEntry(pack, {
    name: "LICENSE-OFL.txt",
    path: licensePath,
    size: licenseStats.size,
  });

  pack.finalize();
  await archivePipeline;
}

async function addEntry(pack, { name, path, size }) {
  const entry = pack.entry({
    name,
    size,
    type: "file",
    mode: 0o644,
    uid: 0,
    gid: 0,
    uname: "",
    gname: "",
    mtime: new Date(0),
  });
  await pipeline(createReadStream(path), entry);
}
