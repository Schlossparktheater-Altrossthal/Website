"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { CloseIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ImageViewer } from "@/components/ui/image-viewer";
import { DEFAULT_TIME_ZONE } from "@/lib/format/date";
import type { EventGallery as Gallery } from "@/lib/media/event-gallery";

import { deleteEventMedia, uploadEventMedia } from "./upload";

const WHEN = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: DEFAULT_TIME_ZONE,
});

/**
 * Probenfotos eines Termins: alle Beteiligten laden hoch (mehrere auf einmal), Tippen öffnet den
 * Betrachter mit Blättern. Nur intern – der Hinweis nennt, wer keine Fotos von sich möchte.
 */
export function EventGallery({ eventId, gallery }: { eventId: string; gallery: Gallery }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState({ done: 0, total: 0 });
  const [viewing, setViewing] = useState<number | null>(null);
  const [removing, setRemoving] = useState<Gallery["photos"][number] | null>(null);
  const { photos } = gallery;
  const busy = uploading.total > 0;

  const upload = async (files: File[]) => {
    if (!files.length) return;
    setUploading({ done: 0, total: files.length });
    let failed = 0;
    // Nacheinander: schont Handy-Verbindung und Server, Fortschritt bleibt verständlich.
    for (const file of files) {
      try {
        await uploadEventMedia(eventId, file, { gallery: true });
      } catch (error) {
        failed += 1;
        toast.error(`${file.name} nicht hochgeladen`, {
          description: error instanceof Error ? error.message : undefined,
          duration: 6000,
        });
      }
      setUploading((current) => ({ ...current, done: current.done + 1 }));
    }
    setUploading({ done: 0, total: 0 });
    if (files.length - failed > 0) {
      toast.success(
        files.length - failed === 1
          ? "Foto hochgeladen"
          : `${files.length - failed} Fotos hochgeladen`,
        { duration: 3000 },
      );
    }
    router.refresh();
  };

  const current = viewing === null ? null : photos[viewing];
  const canDelete = (photo: Gallery["photos"][number]) =>
    gallery.canManage || photo.uploadedById === gallery.userId;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Probenfotos · {photos.length}</h2>
        {gallery.available ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(event) => {
                void upload(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
            <Button
              type="button"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <ImagePlus className="size-4" aria-hidden />
              )}
              {busy ? `Lädt ${uploading.done + 1} von ${uploading.total}…` : "Fotos hinzufügen"}
            </Button>
          </>
        ) : null}
      </div>

      <p className="flex gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Nur für die Beteiligten dieser Probe – bitte nicht weitergeben oder veröffentlichen.
          {gallery.noPhotos.length ? (
            <>
              {" "}
              <span className="font-medium text-foreground">
                Keine Fotos möchten: {gallery.noPhotos.join(", ")}.
              </span>
            </>
          ) : null}
        </span>
      </p>

      {photos.length ? (
        <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
          {photos.map((photo, index) => (
            <li key={photo.id} className="relative">
              <button
                type="button"
                onClick={() => setViewing(index)}
                className="block aspect-square w-full overflow-hidden rounded-md bg-muted"
                aria-label={`Foto ${index + 1} von ${photo.uploaderName ?? "unbekannt"} ansehen`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- geschützte Route, kein Next-Image-Loader */}
                <img
                  src={photo.thumbUrl ?? photo.url}
                  alt={photo.caption ?? `Probenfoto ${index + 1}`}
                  loading="lazy"
                  className="size-full object-cover transition-transform hover:scale-105"
                />
              </button>
              {canDelete(photo) ? (
                <button
                  type="button"
                  onClick={() => setRemoving(photo)}
                  aria-label={`Foto ${index + 1} entfernen`}
                  className="absolute top-1 right-1 flex size-8 items-center justify-center rounded-full bg-background/85 shadow-sm"
                >
                  <CloseIcon className="size-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          <Camera className="size-6" aria-hidden />
          Noch keine Fotos von dieser Probe.
        </div>
      )}

      {current ? (
        <ImageViewer
          open
          onClose={() => setViewing(null)}
          src={current.url}
          alt={current.caption ?? "Probenfoto"}
          downloadHref={`${current.url}?download=1`}
          caption={[
            `${(viewing ?? 0) + 1} / ${photos.length}`,
            current.uploaderName,
            WHEN.format(new Date(current.createdAt)),
            current.caption,
          ]
            .filter(Boolean)
            .join(" · ")}
          onPrev={
            photos.length > 1
              ? () => setViewing((index) => ((index ?? 0) - 1 + photos.length) % photos.length)
              : undefined
          }
          onNext={
            photos.length > 1
              ? () => setViewing((index) => ((index ?? 0) + 1) % photos.length)
              : undefined
          }
        />
      ) : null}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Foto entfernen?"
        description="Das Foto wird für alle endgültig gelöscht."
        confirmLabel="Entfernen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onConfirm={async () => {
          const photo = removing;
          setRemoving(null);
          if (!photo) return;
          try {
            await deleteEventMedia(photo);
            router.refresh();
          } catch (error) {
            toast.error("Nicht entfernt", {
              description: error instanceof Error ? error.message : undefined,
            });
          }
        }}
        onCancel={() => setRemoving(null)}
      />
    </section>
  );
}
