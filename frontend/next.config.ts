import type { NextConfig } from "next";

/**
 * Backend (Render) và frontend (Vercel) là hai origin khác nhau. Cookie auth đặt
 * `sameSite: 'strict'` nên phải proxy /api và /socket.io qua chính domain Vercel để trình
 * duyệt coi là same-origin — không thì cookie không bao giờ được gửi kèm ở production.
 * `BACKEND_URL` là biến server-only (không có prefix NEXT_PUBLIC_), set trên Vercel.
 */
const backendUrl = process.env.BACKEND_URL;

const nextConfig: NextConfig = {
  images: {
    // Ảnh sân, logo đội và avatar được upload lên Cloudinary
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
    ],
  },
  async rewrites() {
    if (!backendUrl) return [];
    return [
      { source: "/api/:path*", destination: `${backendUrl}/api/:path*` },
      { source: "/socket.io/:path*", destination: `${backendUrl}/socket.io/:path*` },
    ];
  },
};

export default nextConfig;
