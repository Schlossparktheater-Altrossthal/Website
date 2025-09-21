import Link from "next/link";

import { BuildInfoTimestamp } from "@/components/build-info-timestamp";
import {
  ctaNavigation,
  primaryNavigation,
  secondaryNavigation,
} from "@/config/navigation";

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
};

export function SiteFooter({ buildInfo, isDevBuild }: SiteFooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative z-20 border-t border-border/60 bg-background/80 backdrop-blur">
      <div className="layout-container py-12 sm:py-16">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:gap-16">
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/80">
                Sommertheater im Schlosspark
              </p>
              <p className="mt-3 max-w-xl text-balance text-lg text-muted-foreground">
                Open-Air-Aufführungen zwischen alten Baumkronen und modernen Inszenierungen.
                Wir verbinden junges Ensemble, regionale Geschichten und atmosphärische Musik zu
                einem sommerlichen Bühnenmoment.
              </p>
            </div>

            <div className="grid gap-4 text-sm text-muted-foreground md:grid-cols-2">
              <address className="not-italic">
                BSZ für Agrarwirtschaft und Ernährung Dresden
                <br /> Altroßthal 1
                <br /> 01169 Dresden
              </address>
              <div>
                <p className="font-medium text-foreground">Kontakt</p>
                <p>
                  <a className="hover:underline" href="mailto:hallo@sommertheater.de">
                    hallo@sommertheater.de
                  </a>
                  <br /> +49&nbsp;176&nbsp;1234567
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Newsletter</p>
              <Link
                href={ctaNavigation.href}
                className="mt-2 inline-flex items-center gap-2 rounded-full border border-dashed border-primary/60 bg-primary/10 px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:border-primary hover:bg-primary/15"
              >
                {ctaNavigation.label}
                <span aria-hidden className="text-base">→</span>
              </Link>
            </div>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <nav aria-label="Bereiche">
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Programm
              </h2>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                {primaryNavigation.map((item) => (
                  <li key={item.href}>
                    <Link className="transition-colors hover:text-primary" href={item.href}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="Service">
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Service
              </h2>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                {secondaryNavigation.map((item) => (
                  <li key={item.href}>
                    <Link className="transition-colors hover:text-primary" href={item.href}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-border/50 pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {currentYear} Schultheater „Sommertheater im Schlosspark“</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link className="transition-colors hover:text-primary" href="/impressum">
              Impressum
            </Link>
            <a className="transition-colors hover:text-primary" href="mailto:hallo@sommertheater.de">
              Kontakt
            </a>
          </div>
          <p className="text-xs text-muted-foreground/80 sm:text-sm">
            {isDevBuild ? (
              <>
                Build {" "}
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
                {" "}· {" "}
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
        </div>
      </div>
    </footer>
  );
}
