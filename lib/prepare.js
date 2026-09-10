import { createHash, randomUUID } from "node:crypto";
import { createWriteStream, readFileSync } from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { Readable } from "node:stream";
import { finished, pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import {
  dirname,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";
import tar from "tar-stream";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packagedManifest = JSON.parse(
  readFileSync(join(packageRoot, "font-assets.json"), "utf8"),
);

export async function prepareFonts({
  projectRoot = process.cwd(),
  config,
  manifest = packagedManifest,
  fetchImplementation = globalThis.fetch,
  log = console.log,
}) {
  const root = resolve(projectRoot);
  const selection = validateConfig(config, manifest);
  const outputDirectory = resolveProjectPath(root, config.outDir, "outDir");
  const cacheDirectory = resolveProjectPath(
    root,
    config.cacheDir ?? "node_modules/.cache/sarasa-gothic-webfont",
    "cacheDir",
  );
  const outputParent = dirname(outputDirectory);
  const stagingDirectory = join(
    outputParent,
    `.${outputDirectory.split(sep).at(-1)}-${randomUUID()}.tmp`,
  );

  await mkdir(cacheDirectory, { recursive: true });
  await mkdir(stagingDirectory, { recursive: true });

  try {
    await Promise.all(
      selection.map(async ({ familyId, family, variant }) => {
        const archivePath = await ensureArchive({
          cacheDirectory,
          familyId,
          variant,
          baseUrl: manifest.baseUrl,
          fetchImplementation,
          log,
        });
        const variantDirectory = join(
          stagingDirectory,
          familyId,
          String(variant.weight),
        );
        await extractArchive(archivePath, variantDirectory);
        await verifyExtractedVariant({
          familyId,
          family,
          variant,
          variantDirectory,
        });
      }),
    );

    await writeFile(
      join(stagingDirectory, "index.css"),
      createStylesheet(selection),
    );
    await writeFile(
      join(stagingDirectory, "selection.json"),
      `${JSON.stringify(createSelectionRecord(selection), null, 2)}\n`,
    );
    await replaceDirectory(stagingDirectory, outputDirectory);
  } catch (error) {
    await rm(stagingDirectory, { recursive: true, force: true });
    throw error;
  }

  log(
    `Prepared ${selection.length} font weight${selection.length === 1 ? "" : "s"} in ${relative(root, outputDirectory) || "."}.`,
  );

  return {
    outDir: outputDirectory,
    selections: selection.map(({ familyId, variant }) => ({
      family: familyId,
      weight: variant.weight,
    })),
  };
}

function validateConfig(config, manifest) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new TypeError(
      "The config default export must be an object created with defineConfig().",
    );
  }

  const allowedKeys = new Set(["outDir", "cacheDir", "families"]);
  const unknownKeys = Object.keys(config).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    throw new TypeError(
      `Config contains unsupported field${unknownKeys.length === 1 ? "" : "s"}: ${unknownKeys.join(", ")}. Allowed fields: outDir, cacheDir, families.`,
    );
  }
  validateRelativePath(config.outDir, "outDir");
  if (config.cacheDir !== undefined) {
    validateRelativePath(config.cacheDir, "cacheDir");
  }
  if (
    !config.families ||
    typeof config.families !== "object" ||
    Array.isArray(config.families)
  ) {
    throw new TypeError("Config field families must be an object.");
  }

  const familyIds = Object.keys(config.families);
  if (familyIds.length === 0) {
    throw new TypeError("Config field families must select at least one family.");
  }

  const selection = [];
  for (const familyId of familyIds) {
    const family = manifest.families?.[familyId];
    if (!family) {
      throw new TypeError(
        `Unknown font family ${JSON.stringify(familyId)}. Available families: ${Object.keys(manifest.families ?? {}).join(", ")}.`,
      );
    }

    const familyConfig = config.families[familyId];
    if (
      !familyConfig ||
      typeof familyConfig !== "object" ||
      Array.isArray(familyConfig) ||
      !Array.isArray(familyConfig.weights) ||
      familyConfig.weights.length === 0
    ) {
      throw new TypeError(
        `Config family ${JSON.stringify(familyId)} must contain a non-empty weights array.`,
      );
    }

    const unknownFamilyKeys = Object.keys(familyConfig).filter(
      (key) => key !== "weights",
    );
    if (unknownFamilyKeys.length > 0) {
      throw new TypeError(
        `Config family ${JSON.stringify(familyId)} contains unsupported field${unknownFamilyKeys.length === 1 ? "" : "s"}: ${unknownFamilyKeys.join(", ")}. Allowed field: weights.`,
      );
    }

    const uniqueWeights = new Set(familyConfig.weights);
    if (uniqueWeights.size !== familyConfig.weights.length) {
      throw new TypeError(
        `Config family ${JSON.stringify(familyId)} contains duplicate weights.`,
      );
    }

    for (const weight of familyConfig.weights) {
      const variant = family.variants?.[String(weight)];
      if (!variant) {
        throw new TypeError(
          `Font family ${JSON.stringify(familyId)} does not provide weight ${JSON.stringify(weight)}. Available weights: ${Object.keys(family.variants ?? {}).join(", ")}.`,
        );
      }
      selection.push({ familyId, family, variant });
    }
  }

  return selection.sort(
    (left, right) =>
      left.familyId.localeCompare(right.familyId) ||
      left.variant.weight - right.variant.weight,
  );
}

function validateRelativePath(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`Config field ${field} must be a non-empty relative path.`);
  }
  if (isAbsolute(value)) {
    throw new TypeError(`Config field ${field} must be relative to the project root.`);
  }

  const normalized = normalize(value);
  if (normalized === "." || normalized === ".." || normalized.startsWith(`..${sep}`)) {
    throw new TypeError(
      `Config field ${field} must point inside the project root, not to the root itself.`,
    );
  }
}

function resolveProjectPath(root, value, field) {
  validateRelativePath(value, field);
  const resolved = resolve(root, value);
  if (!resolved.startsWith(`${root}${sep}`)) {
    throw new TypeError(`Config field ${field} must point inside the project root.`);
  }
  return resolved;
}

async function ensureArchive({
  cacheDirectory,
  familyId,
  variant,
  baseUrl,
  fetchImplementation,
  log,
}) {
  const archivePath = join(cacheDirectory, `${variant.sha256}.tar.gz`);
  if (await archiveMatches(archivePath, variant)) {
    log(`Using cached ${familyId} weight ${variant.weight}.`);
    return archivePath;
  }

  await rm(archivePath, { force: true });
  const assetUrl = new URL(variant.archive, `${baseUrl.replace(/\/$/, "")}/`).href;
  let response;
  try {
    response = await fetchImplementation(assetUrl, { redirect: "follow" });
  } catch (error) {
    throw new Error(
      `Unable to download ${familyId} weight ${variant.weight} from ${assetUrl}: ${error.message}`,
      { cause: error },
    );
  }
  if (!response.ok) {
    throw new Error(
      `Unable to download ${familyId} weight ${variant.weight} from ${assetUrl}: ${response.status} ${response.statusText}.`,
    );
  }

  const archive = Buffer.from(await response.arrayBuffer());
  verifyArchiveBuffer(archive, variant, assetUrl);
  const temporaryPath = `${archivePath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, archive);
  await rename(temporaryPath, archivePath);
  log(`Downloaded ${familyId} weight ${variant.weight}.`);
  return archivePath;
}

async function archiveMatches(path, variant) {
  try {
    const archive = await readFile(path);
    verifyArchiveBuffer(archive, variant, path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    if (error instanceof ArchiveValidationError) {
      return false;
    }
    throw error;
  }
}

function verifyArchiveBuffer(archive, variant, source) {
  if (archive.length !== variant.size) {
    throw new ArchiveValidationError(
      `Font archive ${source} has ${archive.length} bytes; expected ${variant.size}. Update the package or report the mismatched Release asset.`,
    );
  }
  const checksum = createHash("sha256").update(archive).digest("hex");
  if (checksum !== variant.sha256) {
    throw new ArchiveValidationError(
      `Font archive ${source} failed SHA-256 verification. Update the package or report the mismatched Release asset.`,
    );
  }
}

async function extractArchive(archivePath, outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  const extract = tar.extract();

  extract.on("entry", (header, stream, next) => {
    void extractEntry({ header, stream, outputDirectory })
      .then(next)
      .catch((error) => extract.destroy(error));
  });

  await pipeline(
    Readable.from([await readFile(archivePath)]),
    createGunzip(),
    extract,
  );
}

async function extractEntry({ header, stream, outputDirectory }) {
  const name = header.name;
  if (
    typeof name !== "string" ||
    name === "" ||
    name.includes("\\") ||
    name.startsWith("/") ||
    name.split("/").includes("..")
  ) {
    stream.resume();
    await finished(stream);
    throw new Error(`Font archive contains unsafe path ${JSON.stringify(name)}.`);
  }

  const destination = resolve(outputDirectory, name);
  if (!destination.startsWith(`${outputDirectory}${sep}`)) {
    stream.resume();
    await finished(stream);
    throw new Error(
      `Font archive path ${JSON.stringify(name)} escapes its output directory.`,
    );
  }

  if (header.type === "directory") {
    await mkdir(destination, { recursive: true });
    stream.resume();
    await finished(stream);
    return;
  }
  if (header.type !== "file") {
    stream.resume();
    await finished(stream);
    throw new Error(
      `Font archive entry ${JSON.stringify(name)} has unsupported type ${JSON.stringify(header.type)}.`,
    );
  }

  await mkdir(dirname(destination), { recursive: true });
  await pipeline(stream, createWriteStream(destination, { mode: 0o644 }));
}

async function verifyExtractedVariant({
  familyId,
  family,
  variant,
  variantDirectory,
}) {
  const files = await readdir(variantDirectory);
  const fontFiles = files.filter((file) => file.endsWith(".woff2"));
  if (fontFiles.length !== variant.fontFiles) {
    throw new Error(
      `Downloaded ${familyId} weight ${variant.weight} contains ${fontFiles.length} WOFF2 files; expected ${variant.fontFiles}.`,
    );
  }
  if (!files.includes("LICENSE-OFL.txt")) {
    throw new Error(
      `Downloaded ${familyId} weight ${variant.weight} does not contain LICENSE-OFL.txt.`,
    );
  }

  const cssPath = join(variantDirectory, "index.css");
  let css;
  try {
    css = await readFile(cssPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        `Downloaded ${familyId} weight ${variant.weight} does not contain index.css.`,
      );
    }
    throw error;
  }
  if (
    !css.includes(`font-family:${JSON.stringify(family.fontFamily)}`) ||
    !css.includes(`font-weight:${variant.weight}`) ||
    !css.includes("unicode-range:")
  ) {
    throw new Error(
      `Downloaded ${familyId} weight ${variant.weight} has invalid font-face metadata.`,
    );
  }
  const references = [
    ...css.matchAll(/url\(["']?\.\/([^"')]+\.woff2)["']?\)/g),
  ].map((match) => match[1]);
  if (
    new Set(references).size !== variant.fontFiles ||
    references.some((file) => !fontFiles.includes(file))
  ) {
    throw new Error(
      `Downloaded ${familyId} weight ${variant.weight} has invalid WOFF2 references in index.css.`,
    );
  }
}

function createStylesheet(selection) {
  const imports = selection
    .map(
      ({ familyId, variant }) =>
        `@import "./${familyId}/${variant.weight}/index.css";`,
    )
    .join("\n");
  const selectedFamilies = new Map(
    selection.map(({ familyId, family }) => [familyId, family]),
  );
  const utilities = [...selectedFamilies.entries()]
    .map(
      ([familyId, family]) =>
        `\n.${family.className}{font-family:${family.fontStack}}\n.${family.variable}{${family.cssVariable}:${family.fontStack}}`,
    )
    .join("\n");

  return `${imports}\n${utilities}\n`;
}

function createSelectionRecord(selection) {
  const families = {};
  for (const { familyId, family, variant } of selection) {
    families[familyId] ??= {
      fontFamily: family.fontFamily,
      version: family.version,
      weights: [],
    };
    families[familyId].weights.push(variant.weight);
  }
  return { schemaVersion: 1, families };
}

async function replaceDirectory(stagingDirectory, outputDirectory) {
  const backupDirectory = `${outputDirectory}.${randomUUID()}.old`;
  let hadExistingOutput = false;

  try {
    await stat(outputDirectory);
    await rename(outputDirectory, backupDirectory);
    hadExistingOutput = true;
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  try {
    await rename(stagingDirectory, outputDirectory);
  } catch (error) {
    if (hadExistingOutput) {
      await rename(backupDirectory, outputDirectory);
    }
    throw error;
  }

  if (hadExistingOutput) {
    await rm(backupDirectory, { recursive: true, force: true });
  }
}

class ArchiveValidationError extends Error {}
