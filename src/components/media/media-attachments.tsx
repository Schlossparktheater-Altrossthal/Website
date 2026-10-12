"use client";

import { useRef, useState } from "react";
import { FileText, ImagePlus, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";

import { CloseIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ImageViewer } from "@/components/ui/image-viewer";
import type { ProtocolMedia } from "@/lib/calendar/protocol";
import { cn } from "@/lib/utils";

import { deleteEventMedia, formatDuration, uploadEventMedia, type UploadFields } from "./upload";
import { VoiceRecorder } from "./voice-recorder";

/** Anhänge anzeigen: Fotos als Vorschau (Tippen = groß), Audio mit Player, PDFs als Link. */
export function MediaAttachments({
  media,
  canDelete,
  onDeleted,
  className,
}: {
  media: readonly ProtocolMedia[];
  canDelete?: (media: ProtocolMedia) => boolean;
  onDeleted?: (media: ProtocolMedia) => void;
  className?: string;
}) {
  const [viewing, setViewing] = useState<ProtocolMedia | null>(null);
  const [removing, setRemoving] = useState<ProtocolMedia | null>(null);
  if (!media.length) return null;
  const images = media.filter((item) => item.kind === "IMAGE");
  const others = media.filter((item) => item.kind !== "IMAGE");

  const removeButton = (item: ProtocolMedia, overlay = false) =>
    canDelete?.(item) ? (
      <button
        type="button"
        onClick={() => setRemoving(item)}
        aria-label={`${item.fileName} entfernen`}
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          overlay
            ? "absolute top-0.5 right-0.5 bg-background/85 shadow-sm"
            : "text-muted-foreground hover:bg-muted",
        )}
      >
        <CloseIcon className="size-3.5" />
      </button>
    ) : null;

  return (
    <div className={cn("space-y-2", className)}>
      {images.length ? (
        <ul className="flex flex-wrap gap-2">
          {images.map((item) => (
            <li key={item.id} className="relative">
              <button
                type="button"
                onClick={() => setViewing(item)}
                className="block overflow-hidden rounded-md border border-border"
                aria-label={`${item.caption ?? item.fileName} ansehen`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- geschützte Route, kein Next-Image-Loader */}
                <img
                  src={item.thumbUrl ?? item.url}
                  alt={item.caption ?? item.fileName}
                  loading="lazy"
                  className="size-20 object-cover"
                />
              </button>
              {removeButton(item, true)}
            </li>
          ))}
        </ul>
      ) : null}
      {others.map((item) =>
        item.kind === "AUDIO" ? (
          <div key={item.id} className="flex items-center gap-2">
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="truncate text-xs text-muted-foreground">
                {[item.caption ?? item.fileName, formatDuration(item.durationSec)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <audio controls preload="none" src={item.url} className="h-10 w-full" />
            </div>
            {removeButton(item)}
          </div>
        ) : (
          <div key={item.id} className="flex items-center gap-2 text-sm">
            <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="truncate hover:underline"
            >
              {item.caption ?? item.fileName}
            </a>
            {removeButton(item)}
          </div>
        ),
      )}
      {viewing ? (
        <ImageViewer
          open
          onClose={() => setViewing(null)}
          src={viewing.url}
          alt={viewing.caption ?? viewing.fileName}
          downloadHref={`${viewing.url}?download=1`}
        />
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Anhang entfernen?"
        description="Die Datei wird endgültig gelöscht."
        confirmLabel="Entfernen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onConfirm={async () => {
          const item = removing;
          setRemoving(null);
          if (!item) return;
          try {
            await deleteEventMedia(item);
            onDeleted?.(item);
          } catch (error) {
            toast.error("Nicht entfernt", {
              description: error instanceof Error ? error.message : undefined,
            });
          }
        }}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}

/**
 * Knöpfe zum Anhängen: Foto (Kamera oder Galerie), Sprachmemo, Datei (Audio/PDF). Lädt sofort
 * hoch – Anhänge brauchen Netz, Text geht auch offline.
 */
export function AttachButtons({
  eventId,
  fields,
  onUploaded,
  photo = true,
  voice = true,
  file = true,
  fileLabel = "Datei",
}: {
  eventId: string;
  fields?: UploadFields;
  onUploaded: (media: ProtocolMedia) => void;
  photo?: boolean;
  voice?: boolean;
  file?: boolean;
  fileLabel?: string;
}) {
  const [busy, setBusy] = useState(0);
  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (input: File, extra: UploadFields = {}) => {
    setBusy((count) => count + 1);
    try {
      onUploaded(await uploadEventMedia(eventId, input, { ...fields, ...extra }));
    } catch (error) {
      toast.error(`${input.name} nicht hochgeladen`, {
        description: error instanceof Error ? error.message : undefined,
        duration: 6000,
      });
    } finally {
      setBusy((count) => count - 1);
    }
  };
  const pick = (files: FileList | null) => {
    for (const entry of Array.from(files ?? [])) void upload(entry);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {photo ? (
        <>
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              pick(event.target.files);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => photoRef.current?.click()}
          >
            <ImagePlus className="size-4" aria-hidden />
            Foto
          </Button>
        </>
      ) : null}
      {voice ? (
        <VoiceRecorder
          onRecorded={(recorded, durationSec) => void upload(recorded, { memo: true, durationSec })}
        />
      ) : null}
      {file ? (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*,application/pdf"
            multiple
            hidden
            onChange={(event) => {
              pick(event.target.files);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="size-4" aria-hidden />
            {fileLabel}
          </Button>
        </>
      ) : null}
      {busy ? (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          lädt hoch…
        </span>
      ) : null}
    </div>
  );
}
