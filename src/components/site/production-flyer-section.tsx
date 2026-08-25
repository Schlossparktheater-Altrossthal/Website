"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { useFrontendEditing } from "@/components/frontend-editing/frontend-editing-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

type Props = {
  active: boolean;
  title: string | null;
  description: string | null;
  hasImage: boolean;
};

export function ShowFlyerSection({ active, title, description, hasImage }: Props) {
  const { status } = useSession();
  const { hasFeature, openFeature, closeFeature, activeFeature } = useFrontendEditing();
  const canEdit = status === "authenticated" && hasFeature("FEATURE.HOME.FLYER");
  const open = canEdit && activeFeature === "FEATURE.HOME.FLYER";

  const [form, setForm] = useState({
    active,
    title: title ?? "",
    description: description ?? "",
  });
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function removeImage() {
    const res = await fetch("/api/website/show-flyer/image", {
      method: "DELETE",
    });
    if (!res.ok) return toast.error("Bild konnte nicht entfernt werden.");
    toast.success("Gespeichert ✓", { duration: 3000 });
    window.location.reload();
  }

  async function save() {
    const meta = await fetch("/api/website/show-flyer", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        active: form.active,
        title: form.title || null,
        description: form.description || null,
      }),
    });
    if (!meta.ok) return toast.error("Flyer konnte nicht gespeichert werden.");
    if (file) {
      const fd = new FormData();
      fd.append("image", file);
      const up = await fetch("/api/website/show-flyer/image", {
        method: "POST",
        body: fd,
      });
      if (!up.ok) return toast.error("Bild konnte nicht gespeichert werden.");
    }
    toast.success("Gespeichert ✓", { duration: 3000 });
    closeFeature();
    window.location.reload();
  }

  if (!active && !canEdit) return null;

  return (
    <section className="w-full py-[clamp(2rem,6vw,5rem)] text-center">
      {active ? (
        <div className="layout-container space-y-4">
          {title ? (
            <h2 className="text-[clamp(1.4rem,4vw,2.2rem)] font-semibold">{title}</h2>
          ) : null}
          {hasImage ? (
            <Image
              src="/api/website/show-flyer/image"
              alt={title ?? "Flyer"}
              width={800}
              height={450}
              sizes="(max-width: 768px) 100vw, 800px"
              className="mx-auto block h-auto w-full max-w-[clamp(280px,80vw,800px)]"
            />
          ) : null}
          {description ? (
            <p className="text-muted-foreground text-[clamp(0.9rem,2vw,1.1rem)]">{description}</p>
          ) : null}
        </div>
      ) : null}

      {canEdit ? (
        <div className="mt-4">
          <Button
            size="sm"
            variant={open ? "secondary" : "outline"}
            onClick={() => (open ? closeFeature() : openFeature("FEATURE.HOME.FLYER"))}
          >
            {open ? "Einstellungen schließen" : "Flyer bearbeiten"}
          </Button>
        </div>
      ) : null}

      <Dialog
        open={open}
        onOpenChange={(v) => (v ? openFeature("FEATURE.HOME.FLYER") : closeFeature())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flyer bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <span>Sektion active anzeigen</span>
              <Switch
                checked={form.active}
                onCheckedChange={(next) => setForm((s) => ({ ...s, active: next }))}
              />
            </div>
            <Input
              placeholder="Stücktitle 2026"
              value={form.title}
              onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
            />
            <Textarea
              placeholder="Beschreibung"
              value={form.description}
              onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
            />
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
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
