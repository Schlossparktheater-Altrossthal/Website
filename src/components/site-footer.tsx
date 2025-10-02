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
  siteTitle: string;
};

export function SiteFooter({ buildInfo, isDevBuild, siteTitle }: SiteFooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative z-20 border-t border-border/60 bg-background/80 backdrop-blur">
      <div className="layout-container py-12 sm:py-16">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:gap-16">
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/80">
                {siteTitle}
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
                </p>
              </div>
              <div className="md:col-span-2">
                <p className="font-medium text-foreground">Folge uns</p>
                <a
                  className="mt-2 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  href="https://www.instagram.com/schlossparktheater"
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  <span className="sr-only">Schlossparktheater auf Instagram</span>
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M12 0C8.74 0 8.332.015 7.052.072 5.774.132 4.904.333 4.139.63c-.789.306-1.459.717-2.126 1.384S.934 3.35.63 4.14C.332 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.332 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.205a4.043 4.043 0 1 1 0-8.086 4.043 4.043 0 0 1 0 8.086zm7.846-10.405a1.44 1.44 0 1 1-2.88 0 1.44 1.44 0 0 1 2.88 0z"
                      fill="currentColor"
                    />
                  </svg>
                </a>
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
          <p>
            © {currentYear} Schultheater „{siteTitle}“
          </p>
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
