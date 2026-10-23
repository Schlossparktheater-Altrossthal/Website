"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { saveFundAction } from "@/app/(members)/mitglieder/finanzen/actions";
import { Badge } from "@/components/ui/badge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { FINANCE_FUND_KIND_LABELS } from "@/lib/finance/constants";
import { formatCents } from "@/lib/format/money";

type Kind = keyof typeof FINANCE_FUND_KIND_LABELS;
export type FundView = {
  id: string;
  name: string;
  kind: Kind;
  description: string | null;
  archived: boolean;
  balanceCents: number;
};

type Draft = { id?: string; name: string; kind: Kind; description: string; archived: boolean };

/** Geldtöpfe anlegen, umbenennen, archivieren. Saldo über alle Zeiträume. */
export function FundManager({ funds, canManage }: { funds: FundView[]; canManage: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [busy, setBusy] = React.useState(false);

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    const result = await saveFundAction(draft);
    setBusy(false);
    if (!result.ok) return toast.error(result.error);
    toast.success("Gespeichert.");
    setDraft(null);
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Jeder Topf wird getrennt geführt (z. B. Förderverein, Schule, Barkasse). Geld zwischen
        Töpfen bewegst du später per Umbuchung.
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {funds.map((fund) => (
          <Card key={fund.id} className={fund.archived ? "p-4 opacity-60" : "p-4"}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{fund.name}</div>
                <div className="text-sm text-muted-foreground">
                  {FINANCE_FUND_KIND_LABELS[fund.kind]}
                  {fund.description ? ` · ${fund.description}` : ""}
                </div>
              </div>
              {fund.archived ? <Badge variant="muted">Archiviert</Badge> : null}
            </div>
            <div className="mt-3 flex items-end justify-between">
              <span className="text-2xl font-bold tabular-nums">
                {formatCents(fund.balanceCents)}
              </span>
              {canManage ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setDraft({
                      id: fund.id,
                      name: fund.name,
                      kind: fund.kind,
                      description: fund.description ?? "",
                      archived: fund.archived,
                    })
                  }
                >
                  Bearbeiten
                </Button>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
      {canManage ? (
        <Button
          variant="outline"
          onClick={() => setDraft({ name: "", kind: "bank", description: "", archived: false })}
        >
          + Topf anlegen
        </Button>
      ) : null}
      {draft ? (
        <BottomSheet
          open
          onOpenChange={(next) => !next && setDraft(null)}
          title={draft.id ? "Topf bearbeiten" : "Neuer Topf"}
          description="Name und Art des Geldtopfs"
          footer={
            <Button className="w-full" disabled={busy || !draft.name.trim()} onClick={save}>
              Speichern
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="fund-name">Name</Label>
              <Input
                id="fund-name"
                value={draft.name}
                maxLength={80}
                placeholder="z. B. Förderverein"
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </div>
            <SegmentedControl
              aria-label="Art"
              fullWidth
              value={draft.kind}
              onValueChange={(kind) => setDraft({ ...draft, kind })}
              options={(Object.keys(FINANCE_FUND_KIND_LABELS) as Kind[]).map((value) => ({
                value,
                label: FINANCE_FUND_KIND_LABELS[value],
              }))}
            />
            <div className="space-y-1">
              <Label htmlFor="fund-description">Notiz</Label>
              <Input
                id="fund-description"
                value={draft.description}
                maxLength={200}
                placeholder="z. B. Konto bei der Sparkasse"
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
            </div>
            {draft.id ? (
              <label className="flex items-center justify-between gap-3 text-sm">
                Archiviert (nicht mehr für neue Buchungen)
                <Switch
                  checked={draft.archived}
                  onCheckedChange={(archived) => setDraft({ ...draft, archived })}
                />
              </label>
            ) : null}
          </div>
        </BottomSheet>
      ) : null}
    </div>
  );
}
