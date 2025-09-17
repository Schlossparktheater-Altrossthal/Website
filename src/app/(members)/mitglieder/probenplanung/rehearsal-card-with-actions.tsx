"use client";

import * as React from "react";
import { useState } from "react";
import type { Prisma } from "@prisma/client";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { EditIcon, TrashIcon } from "@/components/ui/icons";
import { EditRehearsalModal } from "./edit-rehearsal-modal";
import { DeleteRehearsalConfirm } from "./delete-rehearsal-confirm";

type RehearsalWithRelations = Prisma.RehearsalGetPayload<{
  include: {
    attendance: {
      include: {
        user: { select: { id: true; name: true; email: true } };
      };
    };
    notifications: {
      include: {
        recipients: {
          include: {
            user: { select: { id: true; name: true; email: true } };
          };
        };
      };
    };
  };
}>;

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "full",
});

const timeFormatter = new Intl.DateTimeFormat("de-DE", {
  timeStyle: "short",
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

export function RehearsalCardWithActions({ rehearsal, forceOpen }: { rehearsal: RehearsalWithRelations; forceOpen?: boolean }) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const notification = rehearsal.notifications[0];
  const yes = rehearsal.attendance.filter((entry) => entry.status === "yes");
  const no = rehearsal.attendance.filter((entry) => entry.status !== "yes");
  const respondedIds = new Set(rehearsal.attendance.map((entry) => entry.userId));
  type RecipientWithUser = RehearsalWithRelations["notifications"][number]["recipients"][number];
  const pending: RecipientWithUser[] = notification
    ? notification.recipients.filter((recipient) => !respondedIds.has(recipient.userId))
    : [];

  const menuItems = [
    {
      label: "Bearbeiten",
      icon: <EditIcon className="w-4 h-4" />,
      onClick: () => setShowEditModal(true),
      variant: "default" as const,
    },
    {
      label: "Löschen",
      icon: <TrashIcon className="w-4 h-4" />,
      onClick: () => setShowDeleteConfirm(true),
      variant: "destructive" as const,
    },
  ];

  return (
    <>
      <details className="overflow-hidden rounded-xl border border-border/60 bg-card/60 shadow-sm transition hover:shadow" open={forceOpen ? true : undefined}>
        <summary className="list-none cursor-pointer px-5 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground">{rehearsal.title}</h3>
              <p className="text-sm text-muted-foreground">
                {dateFormatter.format(new Date(rehearsal.start))}
                {" · "}
                {timeFormatter.format(new Date(rehearsal.start))}
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

      {/* Edit Modal */}
      <EditRehearsalModal
        rehearsal={{
          id: rehearsal.id,
          title: rehearsal.title,
          start: new Date(rehearsal.start),
          location: rehearsal.location,
        }}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
      />

      {/* Delete Confirmation */}
      <DeleteRehearsalConfirm
        rehearsal={{
          id: rehearsal.id,
          title: rehearsal.title,
          start: new Date(rehearsal.start),
        }}
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}
