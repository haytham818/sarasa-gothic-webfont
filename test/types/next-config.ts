import { Sarasa_UI_SC } from "sarasa-gothic-webfont/next";
import {
  withSarasa,
  type SarasaNextOptions,
} from "sarasa-gothic-webfont/next/config";

const options = {
  uiSc: {
    weights: [400, 600],
  },
} as const satisfies SarasaNextOptions;

const configure = withSarasa(options, {
  reactStrictMode: true,
});
const font = Sarasa_UI_SC();

void configure;
void font.className;
void font.variable;
void font.style.fontFamily;

withSarasa({
  uiSc: {
    // @ts-expect-error Sarasa UI SC does not provide weight 500.
    weights: [500],
  },
});
