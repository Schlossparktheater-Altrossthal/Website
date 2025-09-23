import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";
import type { Viewport } from "next";
import { ThemeStyleRegistry } from "@/components/theme/theme-style-registry";
import { geistSans, geistMono } from "./fonts";
import {
  DEFAULT_SITE_TITLE,
  readWebsiteSettings,
  resolveWebsiteSettings,
} from "@/lib/website-settings";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || "http://localhost:3000"),
  title: {
    default: DEFAULT_SITE_TITLE,
    template: "%s | Sommertheater",
  },
  description: "Mystische Bühne unter freiem Himmel",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    title: DEFAULT_SITE_TITLE,
    description: "Mystische Bühne unter freiem Himmel",
    images: [
      {
        url: "https://picsum.photos/id/1069/1200/630",
        width: 1200,
        height: 630,
        alt: "Mystischer Schlosspark",
      },
    ],
    locale: "de_DE",
    siteName: "Sommertheater",
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_SITE_TITLE,
    description: "Mystische Bühne unter freiem Himmel",
    images: ["https://picsum.photos/id/1069/1200/630"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "oklch(0.75 0.14 63.3)" },
    { color: "oklch(0.78 0.146 63.3)" },
  ],
  colorScheme: "dark",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let resolvedSettings = resolveWebsiteSettings(null);

  if (process.env.DATABASE_URL) {
    try {
      const record = await readWebsiteSettings();
      if (record) {
        resolvedSettings = resolveWebsiteSettings(record);
      }
    } catch (error) {
      console.error("Failed to load website settings", error);
    }
  }

  const htmlClassName = cn(
    resolvedSettings.colorMode === "dark" ? "dark" : undefined,
    geistSans.variable,
    geistMono.variable,
  );
  const themeTokens = resolvedSettings.theme.tokens;

  return (
    <html lang="de" className={htmlClassName}>
      <head>
        <ThemeStyleRegistry tokens={themeTokens} />
      </head>
      <body className="antialiased bg-background text-foreground">
        <Providers>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-card/90 focus:px-3 focus:py-2"
          >
            Zum Inhalt springen
          </a>
          {children}
        </Providers>
      </body>
    </html>
  );
}
