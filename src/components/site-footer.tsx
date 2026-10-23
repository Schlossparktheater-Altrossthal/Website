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

// Marit hat keinen GitHub-Account und steht bewusst ohne Link.
const CREDITS: { name: string; href?: string }[] = [
  { name: "Jairus", href: "https://github.com/LimitlessGreen" },
  { name: "Alex", href: "https://github.com/7werpmeat" },
  { name: "Nadja", href: "https://github.com/ajdanB" },
  { name: "Marit" },
];

function MadeWithLove() {
  return (
    <p className="group/credits text-center text-xs text-muted-foreground/80">
      Mit{" "}
      <span
        aria-hidden="true"
        className="inline-block text-primary motion-safe:group-hover/credits:animate-pulse"
      >
        ♥
      </span>
      <span className="sr-only">Liebe</span> gebaut von{" "}
      {CREDITS.map((person, index) => (
        <span key={person.name}>
          {index > 0 ? (index === CREDITS.length - 1 ? " & " : ", ") : null}
          {person.href ? (
            <a
              href={person.href}
              target="_blank"
              rel="noopener"
              className="text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
            >
              {person.name}
            </a>
          ) : (
            person.name
          )}
        </span>
      ))}
    </p>
  );
}

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
        <div className="mt-4 border-t border-border/40 pt-4">
          <MadeWithLove />
        </div>
      </div>
    </footer>
  );
}
