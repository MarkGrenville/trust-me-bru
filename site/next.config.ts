import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  turbopack: { root: path.resolve(__dirname, "..") },
};
export default config;
