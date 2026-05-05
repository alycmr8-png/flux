import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@sano/shared", "@sano/i18n"],
};

export default nextConfig;
