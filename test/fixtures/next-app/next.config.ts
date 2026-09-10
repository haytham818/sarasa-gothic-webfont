import type { NextConfig } from "next";
import { withSarasa } from "sarasa-gothic-webfont/next/config";

const nextConfig: NextConfig = {};

export default withSarasa(
  {
    uiSc: {
      weights: [400],
    },
  },
  nextConfig,
);
