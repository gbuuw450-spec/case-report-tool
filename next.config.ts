import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // pdf.js는 묶지 않고 설치된 그대로 서버에서 실행한다. (PDF 쪽수 세기)
  serverExternalPackages: ["pdfjs-dist"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
