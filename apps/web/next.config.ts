import path from "path";
import type { NextConfig } from "next";

const root = path.resolve(__dirname, "../..");

const nextConfig: NextConfig = {
  transpilePackages: ["@sano/shared", "@sano/i18n"],
  serverExternalPackages: ["react-i18next", "i18next"],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      react: path.resolve(root, "node_modules/react"),
      "react-dom": path.resolve(root, "node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(root, "node_modules/react/jsx-runtime"),
      "react/jsx-dev-runtime": path.resolve(root, "node_modules/react/jsx-dev-runtime"),
    };
    return config;
  },
};

export default nextConfig;
