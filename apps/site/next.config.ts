import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@miralith/lubirth-hero",
    "@miralith/visual-core",
    "@miralith/radio-gaga-scene"
  ],
  devIndicators: false
};

export default nextConfig;
