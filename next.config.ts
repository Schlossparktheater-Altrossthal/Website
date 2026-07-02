import type { NextConfig } from "next";

const WATCH_IGNORED_PATTERNS = [
  /(^|[\\/])node_modules([\\/]|$)/,
  /(^|[\\/])\.next([\\/]|$)/,
  /(^|[\\/])\.git([\\/]|$)/,
  /(^|[\\/])(dump|dumps|backup|backups|log|logs|tmp|temp)([\\/]|$)/,
];

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 80],
    minimumCacheTTL: 604800,
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
    turbopackMemoryLimit: 4096,
  },
  // Next.js 15+: serverComponentsExternalPackages moved to serverExternalPackages
  serverExternalPackages: [
    "bcryptjs",
    "pdfkit",
    "qrcode",
    "node-ical",
    "sharp",
    "pg",
    "@prisma/adapter-pg",
  ],
  async redirects() {
    return [
      {
        source: "/mitglieder/essenplanung",
        destination: "/mitglieder/endproben-woche/essenplanung",
        permanent: true,
      },
    ];
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      [
        "img-src 'self' data: blob:",
        "https://www.gravatar.com",
        "https://picsum.photos",
        "https://images.unsplash.com",
        "https://i.imgur.com",
        "https://www.elbmargarita.de",
        "https://www.dresden.de",
        "https://radiodresden.de",
        "https://www.felix-hitzig.de",
      ].join(" "),
      "font-src 'self' data:",
      "connect-src 'self' ws: wss:",
      "media-src 'self' blob: data:",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  turbopack: {},
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ignored: WATCH_IGNORED_PATTERNS,
        poll: false,
      };
    }

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
