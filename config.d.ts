export type SarasaUiScWeight = 200 | 300 | 400 | 600 | 700;

export interface SarasaFontConfig {
  readonly outDir: string;
  readonly cacheDir?: string;
  readonly families: Readonly<{
    "ui-sc": Readonly<{
      weights: readonly SarasaUiScWeight[];
    }>;
  }>;
}

export declare function defineConfig<const Config extends SarasaFontConfig>(
  config: Config,
): Config;
