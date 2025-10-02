import Link from "next/link";

import { BuildInfoTimestamp } from "@/components/build-info-timestamp";
import {
  type NavigationBadgeVariant,
  type NavigationItem,
  type NavigationItemTone,
  ctaNavigation,
  primaryNavigation,
  secondaryNavigation,
} from "@/config/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

const footerIconToneClasses: Record<NavigationItemTone, string> = {
  default: "text-muted-foreground",
  muted: "text-muted-foreground",
  primary: "text-primary",
  success: "text-success",
  info: "text-info",
  warning: "text-warning",
  destructive: "text-destructive",
};

const footerBadgeToneFallback: Partial<
  Record<NavigationItemTone, NavigationBadgeVariant>
> = {
  muted: "muted",
  primary: "default",
  success: "success",
  info: "info",
  warning: "warning",
  destructive: "destructive",
};

function renderFooterNavigationIcon(item: NavigationItem) {
  const IconComponent = item.icon ?? item.activeIcon;
  if (!IconComponent) {
    return null;
  }

  const tone = item.tone ?? "default";
  return (
    <IconComponent
      aria-hidden
      className={cn("h-4 w-4 shrink-0", footerIconToneClasses[tone])}
    />
  );
}

function renderFooterNavigationBadge(item: NavigationItem) {
  if (!item.badge) {
    return null;
  }

  const tone = item.tone ?? "default";
  const variant = item.badge.variant ?? footerBadgeToneFallback[tone] ?? "accent";

  return (
    <Badge
      variant={variant}
      size={item.badge.size ?? "sm"}
      className="whitespace-nowrap"
    >
      {item.badge.label}
    </Badge>
  );
}

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
                    <Link
                      className={cn(
                        "flex items-center gap-2 transition-colors hover:text-primary",
                        item.badge ? "flex-wrap" : undefined,
                      )}
                      href={item.href}
                    >
                      {renderFooterNavigationIcon(item)}
                      <span>{item.label}</span>
                      {renderFooterNavigationBadge(item)}
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
                    <Link
                      className={cn(
                        "flex items-center gap-2 transition-colors hover:text-primary",
                        item.badge ? "flex-wrap" : undefined,
                      )}
                      href={item.href}
                    >
                      {renderFooterNavigationIcon(item)}
                      <span>{item.label}</span>
                      {renderFooterNavigationBadge(item)}
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
            <a
              className="transition-colors hover:text-primary"
              href="https://www.instagram.com/schlossparktheater"
              rel="noreferrer noopener"
              target="_blank"
            >
              Instagram
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
