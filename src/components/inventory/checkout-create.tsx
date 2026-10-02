"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createCheckoutAction } from "@/app/(members)/mitglieder/lager/actions/checkouts";
import { PlusIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { INVENTORY_BASE_PATH } from "@/lib/inventory/constants";

const NONE = "__none__";

/** Neue Ausgabe: wofür, an wen, bis wann – danach geht es direkt zum Scannen. */
export function CheckoutCreate({ shows }: { shows: { id: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [showId, setShowId] = React.useState(NONE);
  const [borrowerName, setBorrowerName] = React.useState("");
  const [dueAt, setDueAt] = React.useState("");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    setSaving(true);
    const result = await createCheckoutAction({
      title,
      showId: showId === NONE ? null : showId,
      borrowerName,
      dueAt: dueAt || null,
      note,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setOpen(false);
    router.push(`${INVENTORY_BASE_PATH}/scannen?modus=ausgeben&ausgabe=${result.data.id}`);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon className="mr-2 h-4 w-4" />
        Neue Ausgabe
      </Button>
      <ResponsivePanel
        open={open}
        onOpenChange={setOpen}
        title="Neue Ausgabe"
        description="Material ausgeben"
        footer={
          <Button className="w-full" size="lg" disabled={saving || !title.trim()} onClick={save}>
            {saving ? "Speichert …" : "Anlegen & scannen"}
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="checkout-title">Wofür?</Label>
            <Input
              id="checkout-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="z. B. Endproben Schlosspark, Leihe Theater X"
              autoFocus
            />
          </div>
          {shows.length ? (
            <div className="space-y-1.5">
              <Label>Produktion (optional)</Label>
              <Select value={showId} onValueChange={setShowId}>
                <SelectTrigger aria-label="Produktion">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Keine</SelectItem>
                  {shows.map((show) => (
                    <SelectItem key={show.id} value={show.id}>
                      {show.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="checkout-borrower">An wen? (optional)</Label>
              <Input
                id="checkout-borrower"
                value={borrowerName}
                onChange={(event) => setBorrowerName(event.target.value)}
                placeholder="Person oder Verein"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="checkout-due">Zurück bis</Label>
              <Input
                id="checkout-due"
                type="date"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="checkout-note">Notiz</Label>
            <Textarea
              id="checkout-note"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </div>
      </ResponsivePanel>
    </>
  );
}
