import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";
import "./theme-fonts";
import type { Viewport } from "next";
import type { Session } from "next-auth";
import { ColorModeScript } from "@/components/theme/color-mode-script";
import { ThemeStyleRegistry } from "@/components/theme/theme-style-registry";
import { geistSans, geistMono } from "./fonts";
import {
  DEFAULT_SITE_TITLE,
  readWebsiteSettingsCached,
  resolveWebsiteSettings,
} from "@/lib/website-settings";
import { cn } from "@/lib/utils";
import { getSession } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { createSyncToken } from "@/lib/sync/tokens";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || "http://localhost:3000"),
  applicationName: "Sommertheater",
  title: {
    default: DEFAULT_SITE_TITLE,
    template: "%s | Sommertheater",
  },
  description: "Mystische Bühne unter freiem Himmel",
  icons: {
    icon: "/Logo-Sommertheater.png",
    shortcut: "/Logo-Sommertheater.png",
    // Aus src/app/apple-icon.tsx (180 px, mit Hintergrund); explizite `icons` ersetzen die Dateikonvention.
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
  // Als App vom Home-Bildschirm (iOS): eigenes Fenster ohne Safari-Leisten.
  appleWebApp: {
    capable: true,
    title: "Sommertheater",
    statusBarStyle: "default",
  },
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
        url: "/Logo-Sommertheater.png",
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
    images: ["/Logo-Sommertheater.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Inhalt bis in die Ränder (Notch); Abstände über env(safe-area-inset-*).
  viewportFit: "cover",
  // Android-Chrome: Tastatur verkleinert die Seite, statt Dialoge zu überdecken (iOS: visualViewport).
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "oklch(0.75 0.14 63.3)" },
    { color: "oklch(0.78 0.146 63.3)" },
  ],
  colorScheme: "light dark",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Einstellungen parallel zur Session laden statt danach.
  const settingsPromise = process.env.DATABASE_URL
    ? readWebsiteSettingsCached().catch((error) => {
        console.error("Failed to load website settings", error);
        return null;
      })
    : Promise.resolve(null);
  let session: Session | null = null;
  try {
    session = await getSession();
  } catch (error) {
    console.error("Failed to load session", error);
  }

  let resolvedSettings = resolveWebsiteSettings(null);

  let syncToken: string | null = null;

  if (session?.user && !session.user.isDeactivated && typeof session.user.id === "string") {
    try {
      const canScan = await hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE");

      if (canScan) {
        syncToken = createSyncToken(session.user.id);
      }
    } catch (error) {
      console.error("Failed to prepare sync token", error);
    }
  }

  if (process.env.DATABASE_URL) {
    const record = await settingsPromise;
    if (record) {
      resolvedSettings = resolveWebsiteSettings(record);
    }
  }

  const htmlClassName = cn(
    resolvedSettings.colorMode === "dark" ? "dark" : undefined,
    geistSans.variable,
    geistMono.variable,
  );
  const themeTokens = resolvedSettings.theme.tokens;

  const initialColorScheme =
    resolvedSettings.colorMode === "system" ? "light dark" : resolvedSettings.colorMode;

  return (
    <html
      lang="de"
      className={htmlClassName}
      data-color-mode={resolvedSettings.colorMode}
      style={{ colorScheme: initialColorScheme }}
      suppressHydrationWarning
    >
      <head>
        <ColorModeScript mode={resolvedSettings.colorMode} />
        <ThemeStyleRegistry tokens={themeTokens} />
      </head>
      <body className={cn("antialiased bg-background text-foreground", "overflow-x-hidden")}>
        <Providers syncToken={syncToken}>
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
