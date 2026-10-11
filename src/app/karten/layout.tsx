import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { PUBLIC_TICKETS_PATH } from "@/lib/karten/constants";
import { publicWebsiteUrl } from "@/lib/karten/context";
import { DEFAULT_SITE_TITLE } from "@/lib/website-settings";

export const metadata: Metadata = {
  title: { default: "Karten", template: `%s · Karten · ${DEFAULT_SITE_TITLE}` },
  robots: { index: false, follow: false },
};

/** Öffentliche Kartenseiten ohne Login (docs/Plan/kartenbuchung-plan.md). */
export default function PublicTicketsLayout({ children }: { children: ReactNode }) {
  const website = publicWebsiteUrl();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border/60 bg-card/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Link href={PUBLIC_TICKETS_PATH} className="font-semibold">
            {DEFAULT_SITE_TITLE} · Karten
          </Link>
          <a href={website} className="text-sm text-muted-foreground hover:text-foreground">
            Zur Website
          </a>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:py-8">
        {children}
      </main>
      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-3xl flex-wrap gap-4 px-4 py-4 text-xs text-muted-foreground">
          <a href={`${website}/impressum`} className="hover:text-foreground">
            Impressum
          </a>
          <a href={`${website}/datenschutz`} className="hover:text-foreground">
            Datenschutz
          </a>
          <a href={`${website}/kontakt`} className="hover:text-foreground">
            Kontakt
          </a>
        </div>
      </footer>
    </div>
  );
}
