"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { TaxonPicker } from "@/components/food/taxon-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PendingRestrictionGroup } from "@/lib/food/pending";

import { assignPendingAction, deletePendingAction, splitPendingAction } from "./actions";

type Result = { ok: true; count: number } | { ok: false; error: string };

export function PendingList({ groups }: { groups: PendingRestrictionGroup[] }) {
  const [pending, startTransition] = useTransition();
  const [picking, setPicking] = useState<PendingRestrictionGroup | null>(null);
  const [deleting, setDeleting] = useState<PendingRestrictionGroup | null>(null);

  const run = (operation: () => Promise<Result>, success: (count: number) => string) =>
    startTransition(async () => {
      const result = await operation();
      if (result.ok) toast.success(success(result.count));
      else toast.error(result.error);
    });

  const assign = (group: PendingRestrictionGroup, code: string, name: string) =>
    run(
      () => assignPendingAction(group.key, code),
      (count) => `„${group.text}“ → ${name} (${count}×). Der Text wird künftig erkannt.`,
    );

  if (groups.length === 0) {
    return (
      <Card>
        <p className="py-12 text-center text-sm text-muted-foreground">
          Alle Angaben sind zugeordnet.
        </p>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-0">
        <ul className="divide-y divide-border">
          {groups.map((group) => (
            <li key={group.key} className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 break-words font-medium text-foreground">{group.text}</p>
                <Badge variant="muted" size="sm">
                  {group.count === 1 ? "1 Person" : `${group.count} Personen`}
                </Badge>
                {group.parts.length > 1 ? (
                  <Badge variant="warning" size="sm">
                    Sammeleintrag
                  </Badge>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {group.parts.length > 1 ? (
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => splitPendingAction(group.key),
                        (count) => `${count} Einzeleinträge angelegt`,
                      )
                    }
                  >
                    In {group.parts.length} Einträge aufteilen
                  </Button>
                ) : (
                  group.suggestions.map((suggestion) => (
                    <Button
                      key={suggestion.code}
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => assign(group, suggestion.code, suggestion.name)}
                      title={suggestion.parentName ?? undefined}
                    >
                      {suggestion.name}
                    </Button>
                  ))
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setPicking(group)}
                >
                  Andere …
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={pending}
                  onClick={() => setDeleting(group)}
                >
                  Keine Angabe – löschen
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Dialog open={picking !== null} onOpenChange={(open) => !open && setPicking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>„{picking?.text}“ zuordnen</DialogTitle>
            <DialogDescription>
              Gilt für alle Personen mit diesem Text und für künftige Eingaben.
            </DialogDescription>
          </DialogHeader>
          {picking ? (
            <TaxonPicker
              initialQuery={picking.parts[0] ?? picking.text}
              disabled={pending}
              onPick={(taxon) => {
                const group = picking;
                setPicking(null);
                assign(group, taxon.code, taxon.name);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Eintrag löschen?"
        description={`„${deleting?.text ?? ""}“ wird bei ${deleting?.count ?? 0} Person(en) entfernt. Nur für Angaben ohne Aussage wie „Keine“.`}
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const group = deleting;
          setDeleting(null);
          if (group) {
            run(
              () => deletePendingAction(group.key),
              (count) => `${count} Eintrag/Einträge gelöscht`,
            );
          }
        }}
      />
    </>
  );
}
