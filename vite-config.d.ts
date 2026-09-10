import type { Plugin } from "vite";

import type { SarasaUiScWeight } from "./config.js";

export interface SarasaViteOptions {
  readonly uiSc: Readonly<{
    weights: readonly SarasaUiScWeight[];
  }>;
}

export declare function sarasa(options: SarasaViteOptions): Plugin;
