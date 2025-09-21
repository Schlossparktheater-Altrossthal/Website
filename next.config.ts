import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "i.imgur.com" },
      { protocol: "https", hostname: "www.elbmargarita.de" },
      { protocol: "https", hostname: "www.dresden.de" },
      { protocol: "https", hostname: "radiodresden.de" },
      { protocol: "https", hostname: "www.felix-hitzig.de" },
      { protocol: "https", hostname: "www.gravatar.com" },
    ],
  },
  // Next.js 15+: serverComponentsExternalPackages moved to serverExternalPackages
  serverExternalPackages: ["bcryptjs", "pdfkit", "qrcode", "node-ical"],
};

export default nextConfig;
