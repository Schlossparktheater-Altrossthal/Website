import { BuildInfoTimestamp } from "@/components/build-info-timestamp";

type CommitInfo = {
  short: string;
  full: string;
};

type BuildInfo = {
  commit: CommitInfo | null;
  timestamp: string;
  isoTimestamp: string;
};

type SiteFooterProps = {
  buildInfo: BuildInfo;
  isDevBuild: boolean;
  isAuthenticated: boolean;
};

export function SiteFooter({ buildInfo, isDevBuild, isAuthenticated }: SiteFooterProps) {
  return (
    <footer className="relative z-20 border-t border-border/60 bg-background/80 backdrop-blur">
      <div className="layout-container py-6">
        <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Sommertheater-Altrossthal</p>
          {isAuthenticated ? (
            <p className="text-xs text-muted-foreground/80 sm:text-sm">
              {isDevBuild ? (
                <>
                  Build{" "}
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
                  )}{" "}
                  ·{" "}
                  <BuildInfoTimestamp
                    formattedTimestamp={buildInfo.timestamp}
                    isoTimestamp={buildInfo.isoTimestamp}
                  />
                </>
              ) : (
                <BuildInfoTimestamp
                  formattedTimestamp={buildInfo.timestamp}
                  isoTimestamp={buildInfo.isoTimestamp}
                />
              )}
            </p>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
