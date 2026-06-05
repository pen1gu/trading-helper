import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // localhost 대신 127.0.0.1로 접속할 때 HMR 등 dev 리소스 허용
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
