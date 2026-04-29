import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@miralith/lubirth-hero", "@miralith/visual-core"],
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false
};

export default nextConfig;
