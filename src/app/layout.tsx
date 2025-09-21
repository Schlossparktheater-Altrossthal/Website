import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import Link from "next/link";
import { MysticBackground } from "@/components/mystic-background";
import type { Viewport } from "next";
import { execSync } from "node:child_process";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || "http://localhost:3000"),
  title: {
    default: "Sommertheater im Schlosspark",
    template: "%s | Sommertheater",
  },
  description: "Mystische Bühne unter freiem Himmel",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    title: "Sommertheater im Schlosspark",
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
    title: "Sommertheater im Schlosspark",
    description: "Mystische Bühne unter freiem Himmel",
    images: ["https://picsum.photos/id/1069/1200/630"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#b68b2e" },
    { color: "#b68b2e" },
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

  const commit = getCommitInfo();

  return {
    commit,
    timestamp,
  } satisfies { commit: CommitInfo | null; timestamp: string };
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="dark">
      <body className="antialiased bg-background text-foreground">
        <Providers>
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-card/90 focus:px-3 focus:py-2">Zum Inhalt springen</a>
          <MysticBackground />
          <SiteHeader />
          <main id="main" className="pt-16 sm:pt-20 min-h-screen">{children}</main>
          <footer className="border-t bg-background/60">
            <div className="container mx-auto p-4 text-sm opacity-80">
              <div>
                © Schultheater „Sommertheater im Schlosspark“ · {" "}
                <Link href="/impressum" className="underline hover:no-underline">
                  Impressum
                </Link>
              </div>
              <div className="mt-1 text-xs">
                {isDevBuild ? (
                  <>
                    Build
                    {" "}
                    {buildInfo.commit ? (
                      <a
                        href={`https://github.com/Schlossparktheater-Altrossthal/Website/commit/${buildInfo.commit.full}`}
                        className="underline hover:no-underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        #{buildInfo.commit.short}
                      </a>
                    ) : (
                      "#unbekannt"
                    )}
                    {" "}· Stand {buildInfo.timestamp}
                  </>
                ) : (
                  <>Stand {buildInfo.timestamp}</>
                )}
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
