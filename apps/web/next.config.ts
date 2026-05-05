import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@sano/shared", "@sano/i18n"],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      // Force a single React instance across all workspace packages
      react: path.resolve(__dirname, "../../node_modules/react"),
      "react-dom": path.resolve(__dirname, "../../node_modules/react-dom"),
    };
    return config;
  },
};

export default nextConfig;
