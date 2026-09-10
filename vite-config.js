import { resolve } from "node:path";

import { prepareFonts } from "./lib/prepare.js";

const generatedStylesheetImport = "@sarasa-gothic-webfont/generated";
const generatedDirectory =
  "node_modules/.cache/sarasa-gothic-webfont/vite-generated";
const archiveCacheDirectory =
  "node_modules/.cache/sarasa-gothic-webfont/archives";

export function sarasa(options) {
  validateOptions(options);
  const preparations = new Map();

  return {
    name: "sarasa-gothic-webfont",
    enforce: "pre",
    async config(config) {
      const projectRoot = resolve(config.root ?? process.cwd());
      let preparation = preparations.get(projectRoot);

      if (!preparation) {
        preparation = prepareFonts({
          projectRoot,
          config: {
            outDir: generatedDirectory,
            cacheDir: archiveCacheDirectory,
            families: {
              "ui-sc": options.uiSc,
            },
          },
        });
        preparations.set(projectRoot, preparation);
        preparation.catch(() => preparations.delete(projectRoot));
      }

      const { outDir } = await preparation;
      return {
        resolve: {
          alias: {
            [generatedStylesheetImport]: resolve(outDir, "index.css"),
          },
        },
      };
    },
  };
}

function validateOptions(options) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("sarasa() expects an options object with uiSc.weights.");
  }

  const unknownKeys = Object.keys(options).filter((key) => key !== "uiSc");
  if (unknownKeys.length > 0) {
    throw new TypeError(
      `sarasa() received unsupported option${unknownKeys.length === 1 ? "" : "s"}: ${unknownKeys.join(", ")}. Allowed option: uiSc.`,
    );
  }

  if (!options.uiSc || typeof options.uiSc !== "object") {
    throw new TypeError("sarasa() requires uiSc.weights.");
  }
}
