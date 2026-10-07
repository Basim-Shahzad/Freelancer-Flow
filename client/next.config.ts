import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: { optimizePackageImports: ["lucide-react", "date-fns"] },
  serverExternalPackages: ["tailwindcss"],
};

export default config;
