import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  customWorkerSrc: "src/sw-custom",
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: {},
  // Produces a standalone build that only includes what's needed — smaller Docker image
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
};

export default withPWA(nextConfig);
