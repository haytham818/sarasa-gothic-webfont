import { access } from "node:fs/promises";
import { isAbsolute, normalize, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import { prepareFonts } from "./prepare.js";

export async function prepareFromConfigFile({
  projectRoot = process.cwd(),
  configPath = "sarasa-font.config.mjs",
} = {}) {
  const root = resolve(projectRoot);
  const resolvedConfigPath = resolveProjectPath(root, configPath, "config file");

  try {
    await access(resolvedConfigPath);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(
        `Config file ${resolvedConfigPath} was not found. Create it or pass --config <path>.`,
      );
    }
    throw error;
  }

  let configModule;
  try {
    configModule = await import(pathToFileURL(resolvedConfigPath));
  } catch (error) {
    throw new Error(
      `Unable to load config file ${resolvedConfigPath}: ${error.message}`,
      { cause: error },
    );
  }

  return prepareFonts({
    projectRoot: root,
    config: configModule.default,
  });
}

function resolveProjectPath(root, value, field) {
  validateRelativePath(value, field);
  const resolved = resolve(root, value);
  if (!resolved.startsWith(`${root}${sep}`)) {
    throw new TypeError(`Config field ${field} must point inside the project root.`);
  }
  return resolved;
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
