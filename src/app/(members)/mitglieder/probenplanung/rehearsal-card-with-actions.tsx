"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { EditIcon, TrashIcon } from "@/components/ui/icons";
import { toast } from "sonner";
import { createRehearsalDraftAction, deleteRehearsalAction } from "./actions";
import type { RehearsalLite } from "./rehearsal-list";

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "full",
  timeZone: "Europe/Berlin",
});

const timeFormatter = new Intl.DateTimeFormat("de-DE", {
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});

function displayName(user?: { name: string | null; email: string | null }) {
  if (!user) return "Unbekannt";
  return user.name?.trim() || user.email?.trim() || "Unbekannt";
}

function ResponseColumn({
  title,
  people,
  emptyText,
}: {
  title: string;
  people: Array<{ id: string; name: string | null; email: string | null }>;
  emptyText: string;
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-foreground/90">{title}</div>
      {people.length ? (
        <ul className="space-y-1 text-sm">
          {people.map((person) => (
            <li
              key={person.id}
              className="rounded border border-border/50 bg-background/80 px-2 py-1"
            >
              {displayName(person)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      )}
    </div>
  );
}

export function RehearsalCardWithActions({ rehearsal, forceOpen }: { rehearsal: RehearsalLite; forceOpen?: boolean }) {
  const router = useRouter();
  const [isEditingTransition, startEditingTransition] = useTransition();
  const [isDeletingTransition, startDeletingTransition] = useTransition();

  const startDate = useMemo(() => new Date(rehearsal.start), [rehearsal.start]);
  const notification = rehearsal.notifications[0];
  const yes = rehearsal.attendance.filter((entry) => entry.status === "yes");
  const no = rehearsal.attendance.filter((entry) => entry.status !== "yes");
  const respondedIds = useMemo(
    () => new Set(rehearsal.attendance.map((entry) => entry.userId)),
    [rehearsal.attendance]
  );
  type RecipientLite = RehearsalLite["notifications"][number]["recipients"][number];
  const pending: RecipientLite[] = notification
    ? notification.recipients.filter((recipient) => !respondedIds.has(recipient.userId))
    : [];

  const handleEdit = () => {
    startEditingTransition(() => {
      createRehearsalDraftAction({
        title: rehearsal.title,
        date: startDate.toISOString().slice(0, 10),
        time: startDate.toISOString().slice(11, 16),
        location: rehearsal.location || "Noch offen"
      })
        .then((result) => {
          if (result?.success && result.id) {
            toast.success("Entwurf für Bearbeitung erstellt.");
            router.push(`/mitglieder/probenplanung/proben/${result.id}`);
          } else {
            toast.error(result?.error ?? "Entwurf konnte nicht erstellt werden.");
          }
        })
        .catch(() => {
          toast.error("Entwurf konnte nicht erstellt werden.");
        });
    });
  };

  const handleDelete = () => {
    if (!confirm(`Probe "${rehearsal.title}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
      return;
    }
    
    startDeletingTransition(() => {
      deleteRehearsalAction({ id: rehearsal.id })
        .then((result) => {
          if (result?.success) {
            toast.success("Probe gelöscht. Alle Beteiligten wurden benachrichtigt.");
            router.refresh();
          } else {
            toast.error(result?.error ?? "Löschen fehlgeschlagen.");
          }
        })
        .catch(() => {
          toast.error("Löschen fehlgeschlagen.");
        });
    });
  };

  const menuItems = [
    {
      label: isEditingTransition ? "Wird vorbereitet..." : "Bearbeiten",
      icon: <EditIcon className="w-4 h-4" />,
      onClick: handleEdit,
      variant: "default" as const,
      disabled: isEditingTransition,
    },
    {
      label: isDeletingTransition ? "Wird gelöscht..." : "Löschen",
      icon: <TrashIcon className="w-4 h-4" />,
      onClick: handleDelete,
      variant: "destructive" as const,
      disabled: isDeletingTransition,
    },
  ];

  return (
    <>
      <details className="overflow-hidden rounded-xl border border-border/60 bg-card/60 shadow-sm transition hover:shadow" open={forceOpen ? true : undefined}>
        <summary className="list-none cursor-pointer px-5 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              <Link
                href={`/mitglieder/proben/${rehearsal.id}`}
                className="text-lg font-semibold text-primary hover:underline"
              >
                {rehearsal.title}
              </Link>
              <p className="text-sm text-muted-foreground">
                {dateFormatter.format(startDate)}
                {" · "}
                {timeFormatter.format(startDate)}
              </p>
              <p className="text-xs text-muted-foreground/80">Ort: {rehearsal.location}</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/50 bg-emerald-500/10 px-2 py-1 text-emerald-600">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> {yes.length}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-300/50 bg-rose-500/10 px-2 py-1 text-rose-600">
                  <span className="inline-block h-2 w-2 rounded-full bg-rose-500" /> {no.length}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted px-2 py-1 text-muted-foreground">
                  <span className="inline-block h-2 w-2 rounded-full bg-slate-400" /> {pending.length}
                </span>
              </div>
              <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu items={menuItems} align="right" />
              </div>
            </div>
          </div>
        </summary>
        <div className="grid gap-6 border-t border-border/60 px-5 py-5 sm:grid-cols-3">
          <ResponseColumn
            title="Zusagen"
            people={yes.map((entry) => ({
              id: entry.user.id,
              name: entry.user.name,
              email: entry.user.email,
            }))}
            emptyText="Noch keine Zusagen."
          />
          <ResponseColumn
            title="Absagen"
            people={no.map((entry) => ({
              id: entry.user.id,
              name: entry.user.name,
              email: entry.user.email,
            }))}
            emptyText="Noch keine Absagen."
          />
          <ResponseColumn
            title="Offen"
            people={pending.map((recipient) => ({
              id: recipient.user.id,
              name: recipient.user.name,
              email: recipient.user.email,
            }))}
            emptyText={notification ? "Alle haben reagiert." : "Es wurde noch keine Benachrichtigung verschickt."}
          />
        </div>
      </details>

      {/* Migration completed: All actions now use draft-based system */}
    </>
  );
}
