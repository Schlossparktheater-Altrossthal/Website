import { unstable_noStore as noStore } from "next/cache";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { execSync } from "node:child_process";

import { MysticBackground } from "@/components/mystic-background";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { authOptions } from "@/lib/auth";
import { readWebsiteSettings, resolveWebsiteSettings } from "@/lib/website-settings";

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
  noStore();

  let session: Session | null = null;
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    console.error("Failed to load session", error);
  }

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
  const maintenanceModeEnabled = resolvedSettings.maintenanceMode;
  const userRoles = extractUserRoles(session);
  const isDeactivated = session?.user?.isDeactivated ?? false;
  const canBypassMaintenance = Boolean(!isDeactivated && userRoles.length > 0);
  const showMaintenanceNotice = maintenanceModeEnabled && !canBypassMaintenance;

  return (
    <div className="app-shell">
      <MysticBackground />
      {!showMaintenanceNotice ? <SiteHeader siteTitle={siteTitle} /> : null}
      <main id="main" className="site-main">
        {showMaintenanceNotice ? (
          <div className="flex min-h-[60svh] items-center justify-center px-6 py-16">
            <MaintenanceNotice siteTitle={siteTitle} />
          </div>
        ) : (
          children
        )}
      </main>
      {!showMaintenanceNotice ? (
        <SiteFooter buildInfo={buildInfo} isDevBuild={isDevBuild} siteTitle={siteTitle} />
      ) : null}
    </div>
  );
}

function extractUserRoles(session: Session | null): string[] {
  if (!session?.user) {
    return [];
  }

  const roles = Array.isArray(session.user.roles) ? session.user.roles : [];
  if (roles.length > 0) {
    return roles;
  }

  const singleRole = session.user.role;
  return typeof singleRole === "string" && singleRole.length > 0 ? [singleRole] : [];
}

function MaintenanceNotice({ siteTitle }: { siteTitle: string }) {
  return (
    <section className="w-full max-w-2xl space-y-6 rounded-3xl border border-border/70 bg-background/80 p-10 text-center shadow-[0_35px_120px_-60px_rgba(15,23,42,0.55)] backdrop-blur">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        Wartungsmodus aktiv
      </h1>
      <p className="text-base leading-relaxed text-muted-foreground">
        {siteTitle} wird gerade überarbeitet. Mitglieder können sich trotzdem anmelden und sehen die vollständige Website.
      </p>
      <div className="flex justify-center">
        <a
          href="/login"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-[0_10px_30px_-15px_rgba(199,120,23,0.55)] transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Zum Login
        </a>
      </div>
      <p className="text-xs text-muted-foreground">
        Sobald die Wartung abgeschlossen ist, ist die öffentliche Seite wieder erreichbar.
      </p>
    </section>
  );
}
