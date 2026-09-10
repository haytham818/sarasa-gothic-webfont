import { spawn } from "node:child_process";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = join(repositoryRoot, "test/fixtures/vite-app");
const buildDirectory = join(fixtureRoot, "dist");
const fixtureNodeModules = join(fixtureRoot, "node_modules");
const manifest = JSON.parse(
  await readFile(join(repositoryRoot, "font-assets.json"), "utf8"),
);
const variant = manifest.families["ui-sc"].variants["400"];
const archiveCache = join(
  fixtureNodeModules,
  ".cache/sarasa-gothic-webfont/archives",
);

try {
  await mkdir(archiveCache, { recursive: true });
  await symlink(
    repositoryRoot,
    join(fixtureNodeModules, "sarasa-gothic-webfont"),
    "dir",
  );
  await copyFile(
    join(repositoryRoot, "dist/font-assets", variant.archive),
    join(archiveCache, `${variant.sha256}.tar.gz`),
  );

  await runViteBuild();
  await verifyBuild();
} finally {
  await rm(buildDirectory, { recursive: true, force: true });
  await rm(fixtureNodeModules, { recursive: true, force: true });
}

async function runViteBuild() {
  const viteCli = join(repositoryRoot, "node_modules/vite/bin/vite.js");
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [viteCli, "build"], {
      cwd: fixtureRoot,
      stdio: "inherit",
    });
    child.once("error", rejectPromise);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(
        new Error(
          `Vite build failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}.`,
        ),
      );
    });
  });
}

async function verifyBuild() {
  const files = await listFiles(buildDirectory);
  const stylesheets = files.filter((file) => file.endsWith(".css"));
  const fontFiles = files.filter((file) => file.endsWith(".woff2"));
  const css = (
    await Promise.all(stylesheets.map((file) => readFile(file, "utf8")))
  ).join("\n");

  if (fontFiles.length === 0 || !css.includes("Sarasa UI SC")) {
    throw new Error(
      "Vite build did not emit the configured Sarasa UI SC stylesheet and font files.",
    );
  }
  console.log(`Verified Vite output with ${fontFiles.length} WOFF2 files.`);
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    }),
  );
  return files.flat();
}
