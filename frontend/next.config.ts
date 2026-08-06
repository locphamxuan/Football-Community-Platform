import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Ảnh sân, logo đội và avatar được upload lên Cloudinary
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
