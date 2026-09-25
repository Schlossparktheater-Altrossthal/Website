/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [25, 50, 75, 80, 90, 95, 100],
    minimumCacheTTL: 604800,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      { protocol: "https", hostname: "www.gravatar.com" },
    ],
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
      { source: "/", destination: "/mitglieder", permanent: false },
    ];
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      ["img-src 'self' data: blob:", "https://www.gravatar.com", "https://picsum.photos"].join(" "),
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
  turbopack: {
    root: process.cwd(),
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ignored: [
          /(^|[\\/])node_modules([\\/]|$)/,
          /(^|[\\/])\.next([\\/]|$)/,
          /(^|[\\/])\.git([\\/]|$)/,
          /(^|[\\/])(dump|dumps|backup|backups|log|logs|tmp|temp)([\\/]|$)/,
        ],
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
