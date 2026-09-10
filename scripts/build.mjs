import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { chmod, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { path7za } = require("7zip-bin");
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = JSON.parse(
  await readFile(join(repositoryRoot, "font-source.json"), "utf8"),
);
const cacheDirectory = join(repositoryRoot, ".cache");
const archivePath = join(cacheDirectory, `SarasaUiSC-${source.version}.7z`);
const sourceDirectory = join(cacheDirectory, `source-${source.version}`);

await mkdir(cacheDirectory, { recursive: true });
await ensureArchive();
await extractSources();

for (const variant of source.variants) {
  await buildVariant(variant);
}

console.log(`Built ${source.family} ${source.version}.`);

async function ensureArchive() {
  let archive;

  try {
    archive = await readFile(archivePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    const response = await fetch(source.assetUrl);
    if (!response.ok) {
      throw new Error(
        `Unable to download ${source.assetUrl}: ${response.status} ${response.statusText}`,
      );
    }

    archive = Buffer.from(await response.arrayBuffer());
    await writeFile(archivePath, archive);
  }

  const checksum = createHash("sha256").update(archive).digest("hex");
  if (checksum !== source.sha256) {
    await rm(archivePath, { force: true });
    throw new Error(
      `Archive checksum mismatch: expected ${source.sha256}, received ${checksum}`,
    );
  }
}

async function extractSources() {
  await rm(sourceDirectory, { recursive: true, force: true });
  await mkdir(sourceDirectory, { recursive: true });

  if (process.platform !== "win32") {
    await chmod(path7za, 0o755);
  }

  execFileSync(
    path7za,
    [
      "e",
      archivePath,
      `-o${sourceDirectory}`,
      "-y",
      ...source.variants.map((variant) => variant.sourceFile),
    ],
    { stdio: "inherit" },
  );
}

async function buildVariant(variant) {
  const outputDirectory = join(repositoryRoot, "fonts", variant.name);
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });

  const executable = process.platform === "win32" ? "cn-font-split.cmd" : "cn-font-split";
  await runFontSplit(executable, [
    "run",
    "--input",
    join(sourceDirectory, variant.sourceFile),
    "--outDir",
    outputDirectory,
    "--css.fontFamily",
    source.family,
    "--css.fontWeight",
    String(variant.weight),
    "--css.fontStyle",
    "normal",
    "--css.fontDisplay",
    "swap",
    "--css.fileName",
    "index.css",
    "--targetType",
    "woff2",
    "--chunkSize",
    "262144",
    "--css.commentUnicodes",
    "false",
  ]);

  const cssPath = join(outputDirectory, "index.css");
  const localSources = variant.localNames
    .map((name) => `local("${name}")`)
    .join(",");
  const css = await readFile(cssPath, "utf8");
  const sourcePattern = /src:(?:local\("[^"]+"\),)*url\(/g;

  if (!sourcePattern.test(css)) {
    throw new Error(`No font sources found in ${cssPath}.`);
  }

  sourcePattern.lastIndex = 0;
  const cssWithLocalSources = css.replaceAll(
    sourcePattern,
    `src:${localSources},url(`,
  );

  await writeFile(cssPath, cssWithLocalSources);

  const generatedFiles = await readdir(outputDirectory);
  await Promise.all(
    generatedFiles
      .filter((file) => file !== "index.css" && !file.endsWith(".woff2"))
      .map((file) => rm(join(outputDirectory, file), { recursive: true, force: true })),
  );

  console.log(`Generated ${variant.name} (${variant.weight}).`);
}

function runFontSplit(executable, arguments_) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(executable, arguments_, {
      cwd: repositoryRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let completed = false;
    let output = "";
    let errorOutput = "";

    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      rejectPromise(new Error("cn-font-split timed out after five minutes."));
    }, 300_000);

    child.stdout.on("data", (chunk) => {
      output += chunk;
      if (/cn-font-split \d+: [\d.]+s/.test(output)) {
        completed = true;
        child.kill("SIGTERM");
      }
    });
    child.stderr.on("data", (chunk) => {
      errorOutput += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      rejectPromise(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (completed) {
        resolvePromise();
        return;
      }

      rejectPromise(
        new Error(
          `cn-font-split exited with code ${code}.\n${errorOutput || output}`,
        ),
      );
    });
  });
}
