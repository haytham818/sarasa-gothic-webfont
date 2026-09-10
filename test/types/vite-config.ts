import { Sarasa_UI_SC } from "sarasa-gothic-webfont/vite";
import {
  sarasa,
  type SarasaViteOptions,
} from "sarasa-gothic-webfont/vite/config";

const options = {
  uiSc: {
    weights: [400, 600],
  },
} as const satisfies SarasaViteOptions;

const plugin = sarasa(options);
const font = Sarasa_UI_SC();

void plugin;
void font.className;
void font.variable;
void font.style.fontFamily;

sarasa({
  uiSc: {
    // @ts-expect-error Sarasa UI SC does not provide weight 500.
    weights: [500],
  },
});
