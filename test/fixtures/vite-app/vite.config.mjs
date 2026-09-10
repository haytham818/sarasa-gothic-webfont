import { defineConfig } from "vite";
import { sarasa } from "sarasa-gothic-webfont/vite/config";

export default defineConfig({
  plugins: [
    sarasa({
      uiSc: {
        weights: [400],
      },
    }),
  ],
});
