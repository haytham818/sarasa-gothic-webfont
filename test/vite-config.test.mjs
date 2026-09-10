import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { sarasa } from "../vite-config.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  await readFile(join(repositoryRoot, "font-assets.json"), "utf8"),
);

test("prepares fonts and configures the generated stylesheet alias", async (context) => {
  const projectRoot = await mkdtemp(join(tmpdir(), "sarasa-vite-config-"));
  context.after(() => rm(projectRoot, { recursive: true, force: true }));

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

  const plugin = sarasa({ uiSc: { weights: [400] } });
  const viteConfig = await plugin.config(
    { root: projectRoot },
    { command: "build", mode: "production" },
  );
  const stylesheet = join(
    projectRoot,
    "node_modules/.cache/sarasa-gothic-webfont/vite-generated/index.css",
  );

  assert.equal(
    viteConfig.resolve.alias["@sarasa-gothic-webfont/generated"],
    stylesheet,
  );
  assert.match(await readFile(stylesheet, "utf8"), /ui-sc\/400\/index\.css/);
});

test("reports unsupported adapter options before creating a plugin", () => {
  assert.throws(
    () => sarasa({ uiSc: { weights: [400] }, outDir: "fonts" }),
    /unsupported option: outDir\. Allowed option: uiSc/,
  );
});
