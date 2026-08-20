import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./fantasyfootball.db"],
  },
};

export default nextConfig;
