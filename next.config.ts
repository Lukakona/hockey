import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hosts allowed to make dev-server requests (values are bare hostnames).
  // Previously set via a stray `module.exports` that Next.js ignored.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
