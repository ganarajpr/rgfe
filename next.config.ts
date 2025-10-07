import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // GitHub Pages deployment configuration
  basePath: process.env.NODE_ENV === 'production' ? '/rgfe' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/rgfe/' : '',
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Prevent bundling heavy client-only libraries on the server
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        '@huggingface/transformers': false,
        'pako': false,
      } as Record<string, unknown>;
    }
    return config;
  },
};

export default nextConfig;
