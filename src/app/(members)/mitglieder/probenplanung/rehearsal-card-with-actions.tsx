"use client";

import Link from "next/link";
import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { EditIcon, TrashIcon } from "@/components/ui/icons";
import { toast } from "sonner";
import { deleteRehearsalAction } from "./actions";
import type { RehearsalLite } from "./rehearsal-list";

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "full",
  timeZone: "Europe/Berlin",
});

const timeFormatter = new Intl.DateTimeFormat("de-DE", {
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});

export function RehearsalCardWithActions({ rehearsal, forceOpen }: { rehearsal: RehearsalLite; forceOpen?: boolean }) {
  const router = useRouter();
  const [isDeletingTransition, startDeletingTransition] = useTransition();

  const startDate = useMemo(() => new Date(rehearsal.start), [rehearsal.start]);

  const handleEdit = () => {
    router.push(`/mitglieder/probenplanung/proben/${rehearsal.id}`);
  };

  const handleDelete = () => {
    if (!confirm(`Probe "${rehearsal.title}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
      return;
    }

    startDeletingTransition(() => {
      deleteRehearsalAction({ id: rehearsal.id })
        .then((result) => {
          if (result?.success) {
            toast.success("Probe gelöscht. Alle Beteiligten wurden informiert.");
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
      label: "Bearbeiten",
      icon: <EditIcon className="w-4 h-4" />,
      onClick: handleEdit,
      variant: "default" as const,
      disabled: false,
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
    <details
      className="overflow-hidden rounded-xl border border-border/60 bg-card/60 shadow-sm transition hover:shadow"
      open={forceOpen ? true : undefined}
    >
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
            <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu items={menuItems} align="right" />
            </div>
          </div>
        </div>
      </summary>
    </details>
  );
}
