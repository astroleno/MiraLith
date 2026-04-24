import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@miralith/lubirth-hero", "@miralith/visual-core"],
  devIndicators: false
};

export default nextConfig;
