import { unstable_noStore as noStore } from "next/cache";
import type { Session } from "next-auth";
import { execSync } from "node:child_process";

import { MysticBackground } from "@/components/mystic-background";
import { BackToTop } from "@/components/ui/back-to-top";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { primaryNavigation } from "@/config/navigation";
import { getSession } from "@/lib/rbac";
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
    session = await getSession();
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
  const visibleNavigationItems = primaryNavigation.filter((item) => {
    if (item.href === "/ueber-uns") return resolvedSettings.pageVisibility.public.about;
    if (item.href === "/mystery") return resolvedSettings.pageVisibility.public.mystery;
    if (item.href === "/unsere-schulkatze") return resolvedSettings.pageVisibility.public.schoolCat;
    if (item.href === "/chronik") return resolvedSettings.pageVisibility.public.timeline;
    return true;
  });
  const maintenanceModeEnabled = resolvedSettings.maintenanceMode;
  const userRoles = extractUserRoles(session);
  const isDeactivated = session?.user?.isDeactivated ?? false;
  const canBypassMaintenance = Boolean(!isDeactivated && userRoles.length > 0);
  const showMaintenanceNotice = maintenanceModeEnabled && !canBypassMaintenance;

  return (
    <div className="app-shell">
      <MysticBackground />
      {!showMaintenanceNotice ? <SiteHeader siteTitle={siteTitle} navigationItems={visibleNavigationItems} /> : null}
      <main id="main" className="site-main">
        {showMaintenanceNotice ? (
          <div className="flex min-h-[60svh] items-center justify-center px-6 py-16">
            <MaintenanceNotice siteTitle={siteTitle} />
          </div>
        ) : (
          children
        )}
      </main>
      {!showMaintenanceNotice ? <BackToTop /> : null}
      {!showMaintenanceNotice ? (
        <SiteFooter
          buildInfo={buildInfo}
          isDevBuild={isDevBuild}
          siteTitle={siteTitle}
          isAuthenticated={Boolean(session?.user)}
          primaryNavigationItems={visibleNavigationItems}
        />
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
    <section className="w-full max-w-2xl space-y-6 rounded-3xl border border-border/70 bg-background/80 p-10 text-center backdrop-blur">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        Wartungsmodus aktiv
      </h1>
      <p className="text-base leading-relaxed text-muted-foreground">
        {siteTitle} wird gerade überarbeitet. Mitglieder können sich trotzdem anmelden und sehen die vollständige Website.
      </p>
      <div className="flex justify-center">
        <a
          href="/login"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
