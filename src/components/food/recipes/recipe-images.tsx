"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  deleteRecipeImageAction,
  makeRecipeCoverImageAction,
  updateRecipeImageAction,
  uploadRecipeImageAction,
} from "@/app/(members)/mitglieder/rezepte/actions";
import { ImageIcon, StarIcon, TrashIcon, UploadIcon } from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RecipeImageInfo } from "@/lib/food/recipes/queries";
import { resizeImageFile } from "@/lib/inventory/photo-client";
import { cn } from "@/lib/utils";

/** Quellenangabe unter einem Bild: „Foto: … · Quelle · Lizenz“. */
function ImageCredit({ image, className }: { image: RecipeImageInfo; className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Foto: {image.credit}
      {image.sourceUrl ? (
        <>
          {" · "}
          <a
            href={image.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {safeHost(image.sourceUrl)}
          </a>
        </>
      ) : null}
      {image.license ? ` · ${image.license}` : null}
    </p>
  );
}

function safeHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Titelbild mit Vorschauleiste und Quellenangabe; „Bilder“ öffnet die Verwaltung (hochladen,
 * Titelbild wählen, Quellenangabe ändern, löschen). Jedes Mitglied darf Bilder pflegen (Wiki).
 */
export function RecipeImages({
  recipeId,
  images,
  defaultCredit,
}: {
  recipeId: string;
  images: RecipeImageInfo[];
  defaultCredit: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  const selected = images.find((image) => image.id === selectedId) ?? images[0];

  if (!selected) {
    return (
      <>
        <Button variant="outline" size="sm" onClick={() => setManaging(true)}>
          <ImageIcon />
          Bild hinzufügen
        </Button>
        <ManageImagesDialog
          open={managing}
          onOpenChange={setManaging}
          recipeId={recipeId}
          images={images}
          defaultCredit={defaultCredit}
        />
      </>
    );
  }

  return (
    <figure className="space-y-2">
      <div className="relative overflow-hidden rounded-xl bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element -- geschützte Bild-Route */}
        <img
          src={selected.url}
          alt=""
          width={selected.width}
          height={selected.height}
          className="aspect-[16/9] w-full object-cover sm:aspect-[21/9]"
        />
        <Button
          size="sm"
          variant="secondary"
          className="absolute right-2 top-2 shadow"
          onClick={() => setManaging(true)}
        >
          <ImageIcon />
          Bilder
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ImageCredit image={selected} />
        {images.length > 1 ? (
          <div className="flex gap-1.5">
            {images.map((image) => (
              <button
                key={image.id}
                type="button"
                onClick={() => setSelectedId(image.id)}
                aria-label="Bild anzeigen"
                className={cn(
                  "h-10 w-14 overflow-hidden rounded-md border-2",
                  image.id === selected.id ? "border-primary" : "border-transparent opacity-70",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- geschützte Bild-Route */}
                <img src={image.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <ManageImagesDialog
        open={managing}
        onOpenChange={setManaging}
        recipeId={recipeId}
        images={images}
        defaultCredit={defaultCredit}
      />
    </figure>
  );
}

function ManageImagesDialog({
  open,
  onOpenChange,
  recipeId,
  images,
  defaultCredit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: string;
  images: RecipeImageInfo[];
  defaultCredit: string;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [credit, setCredit] = useState(defaultCredit);
  const [sourceUrl, setSourceUrl] = useState("");
  const [uploading, startUpload] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const run = async (imageId: string, action: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusyId(imageId);
    const result = await action();
    setBusyId(null);
    if (!result.ok) toast.error(result.error ?? "Fehlgeschlagen", { duration: 5000 });
    else router.refresh();
  };

  const upload = () =>
    startUpload(async () => {
      if (!file) return;
      try {
        const resized = await resizeImageFile(file, 1600, 0.85);
        const formData = new FormData();
        formData.set("file", resized);
        formData.set("credit", credit.trim());
        if (sourceUrl.trim()) formData.set("sourceUrl", sourceUrl.trim());
        const result = await uploadRecipeImageAction(recipeId, formData);
        if (!result.ok) {
          toast.error("Nicht hochgeladen", { description: result.error, duration: 5000 });
          return;
        }
        setFile(null);
        setSourceUrl("");
        if (fileInput.current) fileInput.current.value = "";
        toast.success("Bild hinzugefügt", { duration: 2000 });
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Bild nicht lesbar.");
      }
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bilder</DialogTitle>
          <DialogDescription>
            Das erste Bild ist das Titelbild. Zu jedem Bild gehört, von wem es stammt.
          </DialogDescription>
        </DialogHeader>

        {images.length > 0 ? (
          <ul className="divide-y divide-border">
            {images.map((image, position) => (
              <ImageRow
                key={image.id}
                image={image}
                isCover={position === 0}
                busy={busyId === image.id}
                onCover={() => run(image.id, () => makeRecipeCoverImageAction(recipeId, image.id))}
                onDelete={() => run(image.id, () => deleteRecipeImageAction(recipeId, image.id))}
                onSaveCredit={(value) =>
                  run(image.id, () =>
                    updateRecipeImageAction(recipeId, image.id, {
                      credit: value,
                      sourceUrl: image.sourceUrl,
                      license: image.license,
                    }),
                  )
                }
              />
            ))}
          </ul>
        ) : null}

        <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
          <p className="text-sm font-medium">Eigenes Bild hinzufügen</p>
          <Input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="image-credit" className="text-xs">
                Foto von
              </Label>
              <Input
                id="image-credit"
                value={credit}
                onChange={(event) => setCredit(event.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="image-source" className="text-xs">
                Quelle (Link, optional)
              </Label>
              <Input
                id="image-source"
                type="url"
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="https://…"
                className="h-9"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
          <AsyncButton
            onClick={upload}
            isLoading={uploading}
            loadingText="Lädt hoch…"
            disabled={!file || credit.trim().length < 2}
          >
            <UploadIcon />
            Hochladen
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImageRow({
  image,
  isCover,
  busy,
  onCover,
  onDelete,
  onSaveCredit,
}: {
  image: RecipeImageInfo;
  isCover: boolean;
  busy: boolean;
  onCover: () => void;
  onDelete: () => void;
  onSaveCredit: (credit: string) => void;
}) {
  const [credit, setCredit] = useState(image.credit);
  const changed = credit.trim() !== image.credit && credit.trim().length >= 2;
  return (
    <li className={cn("flex items-center gap-3 py-2", busy && "opacity-60")}>
      {/* eslint-disable-next-line @next/next/no-img-element -- geschützte Bild-Route */}
      <img src={image.url} alt="" className="h-12 w-16 shrink-0 rounded-md object-cover" />
      <div className="min-w-0 flex-1 space-y-1">
        <Input
          value={credit}
          onChange={(event) => setCredit(event.target.value)}
          onBlur={() => changed && onSaveCredit(credit.trim())}
          aria-label="Foto von"
          className="h-8 text-sm"
        />
        {isCover ? <p className="text-xs text-muted-foreground">Titelbild</p> : null}
      </div>
      {!isCover ? (
        <Button
          size="icon"
          variant="ghost"
          aria-label="Als Titelbild"
          title="Als Titelbild"
          disabled={busy}
          onClick={onCover}
        >
          <StarIcon />
        </Button>
      ) : null}
      <Button
        size="icon"
        variant="ghost"
        aria-label="Bild löschen"
        title="Bild löschen"
        disabled={busy}
        onClick={onDelete}
      >
        <TrashIcon />
      </Button>
    </li>
  );
}
