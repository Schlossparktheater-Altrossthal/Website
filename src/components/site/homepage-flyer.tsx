"use client";

import Image from "next/image";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { useFrontendEditing } from "@/components/frontend-editing/frontend-editing-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Props = { aktiv: boolean; titel: string | null; beschreibung: string | null; hasBild: boolean };

function Toggle({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 ${checked ? "bg-primary" : "bg-muted"}`}
    >
      <span className={`h-5 w-5 rounded-full bg-background shadow transition-transform duration-200 ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

export function HomepageFlyer({ aktiv, titel, beschreibung, hasBild }: Props) {
  const { status } = useSession();
  const { hasFeature, openFeature, closeFeature, activeFeature } = useFrontendEditing();
  const canEdit = status === "authenticated" && hasFeature("site.homepage-flyer");
  const open = canEdit && activeFeature === "site.homepage-flyer";

  const [form, setForm] = useState({ aktiv, titel: titel ?? "", beschreibung: beschreibung ?? "" });
  const [file, setFile] = useState<File | null>(null);

  async function removeImage() {
    const res = await fetch("/api/homepage/flyer/image", { method: "DELETE" });
    if (!res.ok) return toast.error("Bild konnte nicht entfernt werden.");
    toast.success("Gespeichert ✓", { duration: 3000 });
    window.location.reload();
  }

  async function save() {
    const meta = await fetch("/api/homepage/flyer", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aktiv: form.aktiv, titel: form.titel || null, beschreibung: form.beschreibung || null }),
    });
    if (!meta.ok) return toast.error("Flyer konnte nicht gespeichert werden.");
    if (file) {
      const fd = new FormData();
      fd.append("image", file);
      const up = await fetch("/api/homepage/flyer/image", { method: "POST", body: fd });
      if (!up.ok) return toast.error("Bild konnte nicht gespeichert werden.");
    }
    toast.success("Gespeichert ✓", { duration: 3000 });
    closeFeature();
    window.location.reload();
  }

  return (
    <section className="w-full py-[clamp(2rem,6vw,5rem)] text-center">
      {aktiv ? (
        <div className="layout-container space-y-4">
          {titel ? <h2 className="text-[clamp(1.4rem,4vw,2.2rem)] font-semibold">{titel}</h2> : null}
          {hasBild ? (
            <Image
              src="/api/homepage/flyer/image"
              alt={titel ?? "Flyer"}
              width={800}
              height={450}
              className="mx-auto block h-auto w-full max-w-[clamp(280px,80vw,800px)] shadow-[0_4px_24px_rgba(0,0,0,0.35)]"
            />
          ) : null}
          {beschreibung ? <p className="text-muted-foreground text-[clamp(0.9rem,2vw,1.1rem)]">{beschreibung}</p> : null}
        </div>
      ) : null}

      {canEdit ? (
        <div className="mt-4">
          <Button size="sm" variant={open ? "secondary" : "outline"} onClick={() => (open ? closeFeature() : openFeature("site.homepage-flyer"))}>
            {open ? "Einstellungen schließen" : "Flyer bearbeiten"}
          </Button>
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={(v) => (v ? openFeature("site.homepage-flyer") : closeFeature())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flyer bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <span>Sektion aktiv anzeigen</span>
              <Toggle checked={form.aktiv} onCheckedChange={(next) => setForm((s) => ({ ...s, aktiv: next }))} />
            </div>
            <Input placeholder="Stücktitel 2026" value={form.titel} onChange={(e) => setForm((s) => ({ ...s, titel: e.target.value }))} />
            <Textarea placeholder="Beschreibung" value={form.beschreibung} onChange={(e) => setForm((s) => ({ ...s, beschreibung: e.target.value }))} />
            <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}>
                Datei ändern
              </Button>
              <Button type="button" variant="outline" onClick={removeImage}>
                Entfernen
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
