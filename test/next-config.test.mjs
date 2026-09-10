import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { chdir, cwd } from "node:process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";

import { withSarasa } from "../next-config.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  await readFile(join(repositoryRoot, "font-assets.json"), "utf8"),
);

test("prepares fonts and configures Turbopack and webpack aliases", async (context) => {
  const projectRoot = await mkdtemp(join(tmpdir(), "sarasa-next-config-"));
  const originalWorkingDirectory = cwd();
  context.after(async () => {
    chdir(originalWorkingDirectory);
    await rm(projectRoot, { recursive: true, force: true });
  });

  const variant = manifest.families["ui-sc"].variants["400"];
  const archiveCache = join(
    projectRoot,
    "node_modules/.cache/sarasa-gothic-webfont/archives",
  );
  await mkdir(archiveCache, { recursive: true });
  await copyFile(
    join(repositoryRoot, "dist/font-assets", variant.archive),
    join(archiveCache, `${variant.sha256}.tar.gz`),
  );
  chdir(projectRoot);

  const configure = withSarasa(
    { uiSc: { weights: [400] } },
    async () => ({
      turbopack: {
        resolveAlias: { existing: "existing-target" },
      },
      webpack(config) {
        config.fromUserConfig = true;
        return config;
      },
    }),
  );
  const nextConfig = await configure("phase-production-build", {
    defaultConfig: {},
  });
  const stylesheet = join(
    projectRoot,
    "node_modules/.cache/sarasa-gothic-webfont/next-generated/index.css",
  );

  assert.equal(
    nextConfig.turbopack.resolveAlias["@sarasa-gothic-webfont/generated"],
    "./node_modules/.cache/sarasa-gothic-webfont/next-generated/index.css",
  );
  assert.equal(nextConfig.turbopack.resolveAlias.existing, "existing-target");

  const webpackConfig = nextConfig.webpack(
    { resolve: { alias: { existing: "existing-target" } } },
    {},
  );
  assert.equal(webpackConfig.fromUserConfig, true);
  assert.equal(
    webpackConfig.resolve.alias["@sarasa-gothic-webfont/generated"],
    stylesheet,
  );
  assert.equal(webpackConfig.resolve.alias.existing, "existing-target");
  assert.match(await readFile(stylesheet, "utf8"), /ui-sc\/400\/index\.css/);
});

test("reports unsupported adapter options before loading Next.js config", () => {
  assert.throws(
    () => withSarasa({ uiSc: { weights: [400] }, outDir: "fonts" }),
    /unsupported option: outDir\. Allowed option: uiSc/,
  );
});
