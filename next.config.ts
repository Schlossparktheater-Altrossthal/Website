import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Silences the multi-lockfile workspace root warning by pinning the root to this app
  turbopack: {
    root: __dirname,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
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
  experimental: {
    browsersListForSwc: true,
  },
  // Next.js 15+: serverComponentsExternalPackages moved to serverExternalPackages
  serverExternalPackages: ["bcryptjs", "pdfkit", "qrcode", "node-ical", "sharp"],
  async redirects() {
    return [
      {
        source: "/mitglieder/essenplanung",
        destination: "/mitglieder/endproben-woche/essenplanung",
        permanent: true,
      },
    ];
  },
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias ??= {};
    Object.assign(config.resolve.alias, {
      "@img/sharp-libvips-dev/include": false,
      "@img/sharp-libvips-dev/cplusplus": false,
      "@img/sharp-wasm32/versions": false,
    });
    return config;
  },
};

export default nextConfig;
