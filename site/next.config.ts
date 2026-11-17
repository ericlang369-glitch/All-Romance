import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export", // 纯静态导出到 out/，不需要服务器
  basePath,
  assetPrefix: basePath || undefined,
  reactStrictMode: false, // 动效引擎直接操作 DOM，开发模式下不要双跑 effect
  images: { unoptimized: true },
  devIndicators: false,
};

export default nextConfig;
