import path from "node:path";
import type { NextConfig } from "next";

// This folder is its own app: pin the root so Next never picks up the parent repo's files.
const root = path.resolve(__dirname);

const nextConfig: NextConfig = {
  turbopack: { root },
  outputFileTracingRoot: root,
  async headers() {
    return [{ source: "/owner/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }, { key: "X-Robots-Tag", value: "noindex" }] }];
  },
};
export default nextConfig;
