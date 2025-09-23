import { MysticBackground } from "@/components/mystic-background";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { readWebsiteSettings, resolveWebsiteSettings } from "@/lib/website-settings";
import { execSync } from "node:child_process";

const buildInfo = getBuildInfo();
const isDevBuild = process.env.NODE_ENV === "development";

type CommitInfo = {
  short: string;
  full: string;
};

type BuildInfo = {
  commit: CommitInfo | null;
  timestamp: string;
  isoTimestamp: string;
};

function getBuildInfo(): BuildInfo {
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
  } satisfies BuildInfo;
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

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
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

  const siteTitle = resolvedSettings.siteTitle;

  return (
    <div className="app-shell">
      <MysticBackground />
      <SiteHeader siteTitle={siteTitle} />
      <main id="main" className="site-main">
        {children}
      </main>
      <SiteFooter buildInfo={buildInfo} isDevBuild={isDevBuild} siteTitle={siteTitle} />
    </div>
  );
}
