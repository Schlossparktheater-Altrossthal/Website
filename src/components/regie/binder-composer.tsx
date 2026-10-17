"use client";

import * as React from "react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type BinderPart = { kind: string; label: string; available: boolean };

const STORAGE_KEY = "regie-probenmappe-teile";

/** Probenmappe: Teile per Häkchen wählen (im Browser gemerkt), dann ein Sammel-PDF öffnen. */
export function BinderComposer({
  pdfHref,
  parts,
  defaults,
}: {
  pdfHref: string;
  parts: BinderPart[];
  defaults: string[];
}) {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>(defaults);

  const openSheet = () => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
      if (Array.isArray(saved)) setSelected(saved.filter((kind) => typeof kind === "string"));
    } catch {
      // ungültig gespeichert: Vorauswahl behalten
    }
    setOpen(true);
  };

  const chosen = parts.filter((part) => part.available && selected.includes(part.kind));
  const href = `${pdfHref}?teile=${chosen.map((part) => part.kind).join(",")}`;

  const toggle = (kind: string, checked: boolean) =>
    setSelected((list) => {
      const next = checked ? [...list, kind] : list.filter((entry) => entry !== kind);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // privater Modus o. Ä.: nur für diese Sitzung
      }
      return next;
    });

  return (
    <>
      <Button size="lg" className="w-full" onClick={openSheet}>
        Probenmappe erstellen
      </Button>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Probenmappe"
        description="Was soll in die Mappe? Deine Auswahl wird gemerkt."
        showDescription
        footer={
          <div className="flex gap-2 p-4 sm:px-6">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            {chosen.length ? (
              <Button asChild className="flex-1">
                <a href={href} target="_blank" rel="noopener" onClick={() => setOpen(false)}>
                  PDF öffnen
                </a>
              </Button>
            ) : (
              <Button className="flex-1" disabled>
                PDF öffnen
              </Button>
            )}
          </div>
        }
      >
        <ul className="divide-y rounded-md border">
          {parts.map((part) => (
            <li key={part.kind}>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                <Checkbox
                  checked={part.available && selected.includes(part.kind)}
                  disabled={!part.available}
                  onCheckedChange={(checked) => toggle(part.kind, checked === true)}
                />
                <span className={part.available ? "" : "text-muted-foreground"}>
                  {part.label}
                  {part.available ? null : " – noch keine Daten"}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Mit Deckblatt (Stand und Inhalt). Die Mappe wird beim Öffnen frisch erstellt.
        </p>
      </BottomSheet>
    </>
  );
}
