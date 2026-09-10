import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, readdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { prepareFonts } from "../lib/prepare.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assetDirectory = join(repositoryRoot, "dist", "font-assets");
const manifest = JSON.parse(
  await readFile(join(repositoryRoot, "font-assets.json"), "utf8"),
);

test("downloads only selected weights and reuses the verified cache", async (context) => {
  const projectRoot = await mkdtemp(join(tmpdir(), "sarasa-prepare-"));
  context.after(() => rm(projectRoot, { recursive: true, force: true }));

  const server = createServer(async (request, response) => {
    const file = request.url?.slice(1);
    if (!file || file.includes("/") || file.includes("\\")) {
      response.writeHead(404).end();
      return;
    }

    try {
      const body = await readFile(join(assetDirectory, file));
      response.writeHead(200, { "content-length": body.length });
      response.end(body);
    } catch (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500).end();
    }
  });
  await new Promise((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  context.after(() => new Promise((resolvePromise) => server.close(resolvePromise)));

  const address = server.address();
  const testManifest = {
    ...manifest,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
  const config = {
    outDir: "generated/fonts",
    cacheDir: "cache/fonts",
    families: {
      "ui-sc": {
        weights: [400],
      },
    },
  };
  const firstLog = [];
  const secondLog = [];

  await prepareFonts({
    projectRoot,
    config,
    manifest: testManifest,
    log: (message) => firstLog.push(message),
  });
  await prepareFonts({
    projectRoot,
    config,
    manifest: testManifest,
    log: (message) => secondLog.push(message),
  });

  const outputDirectory = join(projectRoot, "generated", "fonts");
  const stylesheet = await readFile(join(outputDirectory, "index.css"), "utf8");
  const selection = JSON.parse(
    await readFile(join(outputDirectory, "selection.json"), "utf8"),
  );
  const files = await readdir(join(outputDirectory, "ui-sc", "400"));

  assert.match(stylesheet, /ui-sc\/400\/index\.css/);
  assert.match(stylesheet, /\.sarasa-ui-sc-font/);
  assert.deepEqual(selection.families["ui-sc"].weights, [400]);
  assert.equal(files.filter((file) => file.endsWith(".woff2")).length, 105);
  assert.ok(firstLog.some((message) => message.includes("Downloaded ui-sc weight 400")));
  assert.ok(secondLog.some((message) => message.includes("Using cached ui-sc weight 400")));
});

test("rejects output paths outside the project", async () => {
  await assert.rejects(
    prepareFonts({
      config: {
        outDir: "../fonts",
        families: { "ui-sc": { weights: [400] } },
      },
    }),
    /outDir must point inside the project root/,
  );
});

test("reports available weights for an unsupported selection", async () => {
  await assert.rejects(
    prepareFonts({
      config: {
        outDir: "generated/fonts",
        families: { "ui-sc": { weights: [500] } },
      },
    }),
    /does not provide weight 500\. Available weights: 200, 300, 400, 600, 700/,
  );
});
