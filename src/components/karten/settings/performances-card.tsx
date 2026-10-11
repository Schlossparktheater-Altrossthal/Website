"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { savePerformanceTicketingAction } from "@/app/(members)/mitglieder/karten/einstellungen/actions";
import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EditIcon } from "@/components/ui/action-icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalFormDialog } from "@/components/ui/modal-form-dialog";
import { Switch } from "@/components/ui/switch";
import { formatPerformanceDate } from "@/lib/karten/constants";

export type PerformanceRow = {
  eventId: string;
  start: string;
  cancelled: boolean;
  configured: boolean;
  capacity: number;
  onlineLimit: number | null;
  boxOfficeReserve: number;
  salesOpen: boolean;
  salesEndAt: string | null;
  taken: number;
  freeOnline: number;
};

type Draft = {
  capacity: string;
  onlineLimit: string;
  boxOfficeReserve: string;
  salesOpen: boolean;
  salesEndAt: string;
};

function draftFrom(row: PerformanceRow | undefined): Draft {
  return {
    capacity: row?.configured ? String(row.capacity) : "",
    onlineLimit: row?.onlineLimit != null ? String(row.onlineLimit) : "",
    boxOfficeReserve: row?.configured ? String(row.boxOfficeReserve) : "0",
    salesOpen: row?.configured ? row.salesOpen : true,
    salesEndAt: row?.salesEndAt ?? "",
  };
}

export function PerformancesCard({ performances }: { performances: PerformanceRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ ids: string[]; draft: Draft } | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (id: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const openFor = (ids: string[]) =>
    setEditing({ ids, draft: draftFrom(performances.find((row) => row.eventId === ids[0])) });

  const save = () => {
    if (!editing) return;
    const capacity = Number.parseInt(editing.draft.capacity, 10);
    if (!Number.isFinite(capacity) || capacity < 0) {
      toast.error("Bitte die Kapazität angeben.");
      return;
    }
    const onlineLimit = editing.draft.onlineLimit.trim()
      ? Number.parseInt(editing.draft.onlineLimit, 10)
      : null;
    const boxOfficeReserve = Number.parseInt(editing.draft.boxOfficeReserve || "0", 10) || 0;
    const ids = editing.ids;
    startTransition(async () => {
      const result = await savePerformanceTicketingAction(ids, {
        capacity,
        onlineLimit,
        boxOfficeReserve,
        salesOpen: editing.draft.salesOpen,
        salesEndAt:
          ids.length === 1 && editing.draft.salesEndAt ? new Date(editing.draft.salesEndAt) : null,
      });
      if (result.ok) {
        toast.success(result.message ?? "Gespeichert.");
        setEditing(null);
        setSelected(new Set());
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const setDraft = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setEditing((current) =>
      current ? { ...current, draft: { ...current.draft, [key]: value } } : current,
    );

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Vorstellungen</h2>
          <p className="text-sm text-muted-foreground">
            Vorstellungen kommen aus der Terminplanung (Art „Vorstellung“). Freie Platzwahl – hier
            nur Plätze und Kontingente.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={performances.length === 0}
          onClick={() =>
            openFor(selected.size > 0 ? [...selected] : performances.map((row) => row.eventId))
          }
        >
          {selected.size > 0 ? `${selected.size} ausgewählte bearbeiten` : "Alle bearbeiten"}
        </Button>
      </div>

      {performances.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Noch keine Vorstellungen. Lege sie in der Terminplanung mit der Art „Vorstellung“ an.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-md border border-border/60">
          {performances.map((row) => (
            <li key={row.eventId} className="flex min-h-12 flex-wrap items-center gap-3 px-3 py-2">
              <Checkbox
                checked={selected.has(row.eventId)}
                onCheckedChange={(checked) => toggle(row.eventId, checked === true)}
                aria-label={`${formatPerformanceDate(new Date(row.start))} auswählen`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium tabular-nums">
                    {formatPerformanceDate(new Date(row.start))}
                  </span>
                  {row.cancelled ? (
                    <Badge variant="destructive" size="sm">
                      abgesagt
                    </Badge>
                  ) : null}
                  {!row.configured ? (
                    <Badge variant="warning" size="sm">
                      nicht eingerichtet
                    </Badge>
                  ) : !row.salesOpen ? (
                    <Badge variant="muted" size="sm">
                      Online geschlossen
                    </Badge>
                  ) : null}
                </div>
                {row.configured ? (
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {row.taken} von {row.capacity} belegt · {row.freeOnline} online frei
                    {row.boxOfficeReserve > 0 ? ` · ${row.boxOfficeReserve} Reserve Kasse` : ""}
                    {row.onlineLimit !== null ? ` · online max. ${row.onlineLimit}` : ""}
                  </p>
                ) : null}
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Bearbeiten"
                onClick={() => openFor([row.eventId])}
              >
                <EditIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ModalFormDialog
        title={
          editing && editing.ids.length > 1
            ? `${editing.ids.length} Vorstellungen bearbeiten`
            : "Vorstellung bearbeiten"
        }
        open={editing !== null}
        onOpenChange={(open) => (!open ? setEditing(null) : undefined)}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Abbrechen
            </Button>
            <AsyncButton isLoading={pending} onClick={save}>
              Speichern
            </AsyncButton>
          </>
        }
      >
        {editing ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="capacity">Plätze gesamt</Label>
                <Input
                  id="capacity"
                  type="number"
                  min={0}
                  autoFocus
                  value={editing.draft.capacity}
                  onChange={(event) => setDraft("capacity", event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reserve">Reserve Kasse</Label>
                <Input
                  id="reserve"
                  type="number"
                  min={0}
                  value={editing.draft.boxOfficeReserve}
                  onChange={(event) => setDraft("boxOfficeReserve", event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="online-limit">Online höchstens</Label>
                <Input
                  id="online-limit"
                  type="number"
                  min={0}
                  placeholder="ohne Grenze"
                  value={editing.draft.onlineLimit}
                  onChange={(event) => setDraft("onlineLimit", event.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Die Reserve vergeben nur Kartenbüro und Abendkasse. Freikarten zählen wie
              Online-Buchungen gegen die Plätze ohne Reserve.
            </p>
            <div className="flex items-center justify-between gap-4 rounded-md bg-muted/40 p-3">
              <div>
                <p className="text-sm font-medium">Online-Buchung offen</p>
                <p className="text-xs text-muted-foreground">
                  Aus: nur noch Kartenbüro und Abendkasse.
                </p>
              </div>
              <Switch
                checked={editing.draft.salesOpen}
                onCheckedChange={(value) => setDraft("salesOpen", value)}
                aria-label="Online-Buchung offen"
              />
            </div>
            {editing.ids.length === 1 ? (
              <div className="space-y-1.5">
                <Label htmlFor="sales-end">Online-Buchung bis (leer = Vorstellungsbeginn)</Label>
                <Input
                  id="sales-end"
                  type="datetime-local"
                  value={editing.draft.salesEndAt}
                  onChange={(event) => setDraft("salesEndAt", event.target.value)}
                />
              </div>
            ) : null}
            <button type="submit" hidden />
          </form>
        ) : null}
      </ModalFormDialog>
    </Card>
  );
}
