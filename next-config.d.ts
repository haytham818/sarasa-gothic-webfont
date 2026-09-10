import type { NextConfig } from "next";

import type { SarasaUiScWeight } from "./config.js";

export interface SarasaNextOptions {
  readonly uiSc: Readonly<{
    weights: readonly SarasaUiScWeight[];
  }>;
}

export type NextConfigExport =
  | NextConfig
  | Promise<NextConfig>
  | ((
      phase: string,
      context: Readonly<{ defaultConfig: NextConfig }>,
    ) => NextConfig | Promise<NextConfig>);

export declare function withSarasa(
  options: SarasaNextOptions,
  nextConfig?: NextConfigExport,
): (
  phase: string,
  context: Readonly<{ defaultConfig: NextConfig }>,
) => Promise<NextConfig>;
