import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { getTicketActor } from "@/lib/karten/access";
import { BOX_OFFICE_PATH, MEMBERS_TICKETS_PATH } from "@/lib/karten/constants";
import { DEFAULT_SITE_TITLE } from "@/lib/website-settings";

export const metadata: Metadata = {
  title: { default: "Kartenbüro", template: `%s · Kartenbüro · ${DEFAULT_SITE_TITLE}` },
  robots: { index: false, follow: false },
};

/** Kartenbüro für Zugänge ohne Mitgliedskonto (docs/Plan/kartenbuchung-plan.md, K8). */
export default async function BoxOfficeLayout({ children }: { children: ReactNode }) {
  const actor = await getTicketActor();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border/60 bg-card/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href={BOX_OFFICE_PATH} className="font-semibold">
            {DEFAULT_SITE_TITLE} · Kartenbüro
          </Link>
          {actor?.kind === "access" ? (
            <form
              action={`${BOX_OFFICE_PATH}/abmelden`}
              method="post"
              className="flex items-center gap-3"
            >
              <span className="hidden text-sm text-muted-foreground sm:inline">{actor.name}</span>
              <Button type="submit" size="xs" variant="ghost">
                Abmelden
              </Button>
            </form>
          ) : actor?.kind === "member" ? (
            <Link
              href={MEMBERS_TICKETS_PATH}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Zum Mitgliederbereich
            </Link>
          ) : null}
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
