import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir:
    process.env.WORKBENCH_DEV_SERVER === "1" ? ".next-workbench" : ".next",
  // Pi uses variable Node.js imports for its auth context; keep those native.
  serverExternalPackages: [
    "@earendil-works/pi-agent-core",
    "@earendil-works/pi-ai",
  ],
};

export default nextConfig;
