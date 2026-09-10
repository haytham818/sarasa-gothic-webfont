#!/usr/bin/env node

import { prepareFromConfigFile } from "./lib/prepare.js";

const help = `Usage: sarasa-gothic-webfont prepare [--config <path>]

Download the configured Sarasa Gothic font weights and generate a stylesheet.

Options:
  --config <path>  Config file relative to the project root
                   (default: sarasa-font.config.mjs)
  -h, --help       Show this help
`;

const arguments_ = process.argv.slice(2);

if (arguments_.includes("--help") || arguments_.includes("-h")) {
  process.stdout.write(help);
  process.exit(0);
}

const command = arguments_.shift();
if (command !== "prepare") {
  fail(
    command
      ? `Unknown command ${JSON.stringify(command)}. Run sarasa-gothic-webfont --help for usage.`
      : "Missing command. Run sarasa-gothic-webfont --help for usage.",
  );
}

let configPath = "sarasa-font.config.mjs";
while (arguments_.length > 0) {
  const option = arguments_.shift();
  if (option !== "--config") {
    fail(
      `Unknown option ${JSON.stringify(option)}. Run sarasa-gothic-webfont --help for usage.`,
    );
  }

  const value = arguments_.shift();
  if (!value) {
    fail("Option --config requires a path.");
  }
  configPath = value;
}

try {
  await prepareFromConfigFile({ configPath });
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

function fail(message) {
  process.stderr.write(`sarasa-gothic-webfont: ${message}\n`);
  process.exit(1);
}
