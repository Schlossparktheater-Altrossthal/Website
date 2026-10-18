"use client";

import Link from "next/link";

import { ArrowLeftIcon } from "@/components/ui/action-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SessionListItem } from "@/lib/skript/session-protocol";

import { DATE_TIME, STATUS_LABEL, TIME } from "./shared";

export function SessionList({
  versionId,
  versionLabel,
  sessions,
  canManage,
}: {
  versionId: string;
  versionLabel: string;
  sessions: SessionListItem[];
  canManage: boolean;
}) {
  const group = sessions.filter((session) => session.kind === "group");
  const own = sessions.filter((session) => session.kind === "private");
  return (
    <div className="min-h-dvh bg-background">
      <div className="sticky top-0 z-30 border-b border-border/60 bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-12 max-w-3xl items-center gap-1 px-1 lg:px-4">
          <Button asChild variant="ghost" size="icon" aria-label="Zurück zum Skript">
            <Link href={`/mitglieder/skript/${versionId}`}>
              <ArrowLeftIcon aria-hidden />
            </Link>
          </Button>
          <div className="min-w-0 flex-1 px-1">
            <p className="truncate text-sm font-medium">Protokolle</p>
            <p className="truncate text-xs text-muted-foreground">{versionLabel}</p>
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-3xl space-y-6 px-3 py-4 lg:px-6">
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Proben
          </h2>
          {group.length ? (
            <SessionRows versionId={versionId} sessions={group} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {canManage
                ? "Noch keine Aufnahme. Im Leser unter Mitlesen → Aufnahme starten."
                : "Noch kein bestätigtes Probenprotokoll."}
            </p>
          )}
        </section>
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Meine privaten Aufnahmen
          </h2>
          {own.length ? (
            <SessionRows versionId={versionId} sessions={own} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Noch keine. Im Leser unter Ansicht → Mitlesen → „Private Aufnahme“ – nur du siehst
              sie.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

function SessionRows({ versionId, sessions }: { versionId: string; sessions: SessionListItem[] }) {
  return (
    <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
      {sessions.map((session) => {
        const start = new Date(session.startedAt);
        const end = session.endedAt ? new Date(session.endedAt) : null;
        return (
          <li key={session.id}>
            <Link
              href={`/mitglieder/skript/${versionId}/protokolle/${session.id}`}
              className="flex min-h-14 items-center gap-3 px-3 py-2 hover:bg-muted/50"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {session.title ?? session.event?.title ?? DATE_TIME.format(start)}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {DATE_TIME.format(start)}
                  {end ? `–${TIME.format(end)}` : ""}
                  {session.event && session.title ? ` · ${session.event.title}` : ""}
                </span>
              </span>
              <Badge
                size="sm"
                variant={
                  session.status === "confirmed"
                    ? "success"
                    : session.status === "recording"
                      ? "destructive"
                      : "muted"
                }
              >
                {session.kind === "private" && session.status === "draft"
                  ? "Fertig"
                  : STATUS_LABEL[session.status]}
              </Badge>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
