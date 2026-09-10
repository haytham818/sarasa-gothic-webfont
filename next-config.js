import { relative, resolve, sep } from "node:path";

import { prepareFonts } from "./lib/prepare.js";

const generatedStylesheetImport = "@sarasa-gothic-webfont/generated";
const generatedDirectory =
  "node_modules/.cache/sarasa-gothic-webfont/next-generated";
const archiveCacheDirectory =
  "node_modules/.cache/sarasa-gothic-webfont/archives";

export function withSarasa(options, nextConfig = {}) {
  validateOptions(options);
  const preparations = new Map();

  return async (phase, context) => {
    const projectRoot = process.cwd();
    const config = await resolveNextConfig(nextConfig, phase, context);
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
    const stylesheet = resolve(outDir, "index.css");
    return addGeneratedStylesheet(config, stylesheet, projectRoot);
  };
}

function validateOptions(options) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError(
      "withSarasa() expects an options object with uiSc.weights.",
    );
  }

  const unknownKeys = Object.keys(options).filter((key) => key !== "uiSc");
  if (unknownKeys.length > 0) {
    throw new TypeError(
      `withSarasa() received unsupported option${unknownKeys.length === 1 ? "" : "s"}: ${unknownKeys.join(", ")}. Allowed option: uiSc.`,
    );
  }

  if (!options.uiSc || typeof options.uiSc !== "object") {
    throw new TypeError("withSarasa() requires uiSc.weights.");
  }
}

async function resolveNextConfig(nextConfig, phase, context) {
  const resolved =
    typeof nextConfig === "function"
      ? await nextConfig(phase, context)
      : await nextConfig;

  if (resolved === undefined || resolved === null) {
    return {};
  }
  if (typeof resolved !== "object" || Array.isArray(resolved)) {
    throw new TypeError(
      "withSarasa() expected the wrapped Next.js config to resolve to an object.",
    );
  }
  return resolved;
}

function addGeneratedStylesheet(nextConfig, stylesheet, projectRoot) {
  const userWebpack = nextConfig.webpack;
  const turbopackStylesheet = `./${relative(projectRoot, stylesheet).split(sep).join("/")}`;

  return {
    ...nextConfig,
    turbopack: {
      ...nextConfig.turbopack,
      resolveAlias: {
        ...nextConfig.turbopack?.resolveAlias,
        [generatedStylesheetImport]: turbopackStylesheet,
      },
    },
    webpack(config, options) {
      const configured =
        typeof userWebpack === "function" ? userWebpack(config, options) : config;

      if (!configured || typeof configured !== "object") {
        throw new TypeError(
          "The wrapped Next.js webpack() function must return its config object.",
        );
      }

      configured.resolve ??= {};
      const aliases = configured.resolve.alias;
      if (Array.isArray(aliases)) {
        configured.resolve.alias = [
          ...aliases,
          {
            name: generatedStylesheetImport,
            alias: stylesheet,
            onlyModule: true,
          },
        ];
      } else {
        configured.resolve.alias = {
          ...aliases,
          [generatedStylesheetImport]: stylesheet,
        };
      }
      return configured;
    },
  };
}
