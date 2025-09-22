import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MysticBackground } from "@/components/mystic-background";
import type { Viewport } from "next";
import { execSync } from "node:child_process";
import { ThemeStyleRegistry } from "@/components/theme/theme-style-registry";
import {
  DEFAULT_SITE_TITLE,
  readWebsiteSettings,
  resolveWebsiteSettings,
} from "@/lib/website-settings";

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

type CommitInfo = {
  short: string;
  full: string;
};

const buildInfo = getBuildInfo();
const isDevBuild = process.env.NODE_ENV === "development";

function getBuildInfo() {
  const buildDate = new Date();
  const timestamp = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "short",
    timeStyle: "medium",
  }).format(buildDate);
  const isoTimestamp = buildDate.toISOString();

  const commit = getCommitInfo();

  return {
    commit,
    timestamp,
    isoTimestamp,
  } satisfies {
    commit: CommitInfo | null;
    timestamp: string;
    isoTimestamp: string;
  };
}

function getCommitInfo(): CommitInfo | null {
  const envCommit =
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    process.env.COMMIT_REF ??
    null;

  if (envCommit) {
    const normalizedCommit = envCommit.trim();

    return {
      short: normalizedCommit.slice(0, 7),
      full: normalizedCommit,
    } satisfies CommitInfo;
  }

  try {
    const fullCommitHash = execSync("git rev-parse HEAD").toString().trim();

    return {
      short: fullCommitHash.slice(0, 7),
      full: fullCommitHash,
    } satisfies CommitInfo;
  } catch {
    return null;
  }
}

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

  const htmlClassName = resolvedSettings.colorMode === "dark" ? "dark" : undefined;
  const siteTitle = resolvedSettings.siteTitle;
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
          <div className="app-shell">
            <MysticBackground />
            <SiteHeader siteTitle={siteTitle} />
            <main id="main" className="site-main">
              {children}
            </main>
            <SiteFooter buildInfo={buildInfo} isDevBuild={isDevBuild} siteTitle={siteTitle} />
          </div>
        </Providers>
      </body>
    </html>
  );
}
