"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { FileIcon, ImageIcon, UploadIcon, XIcon } from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatFileLibraryFileSize } from "@/lib/file-library-constants";

import { deleteTeamFileAction } from "../file-actions";

export type TeamFile = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  uploaderId: string | null;
  uploaderName: string | null;
};

const DATE = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Berlin",
});

export function TeamFiles({
  departmentId,
  files,
  viewerId,
  canUpload,
  canManage,
}: {
  departmentId: string;
  files: TeamFile[];
  viewerId: string;
  canUpload: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [deleting, setDeleting] = React.useState<TeamFile | null>(null);

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    const body = new FormData();
    for (const file of Array.from(list)) body.append("files", file);
    setUploading(true);
    try {
      const response = await fetch(
        `/api/departments/${encodeURIComponent(departmentId)}/documents`,
        {
          method: "POST",
          body,
        },
      );
      const result: { error?: string; uploaded?: number } = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error("Hochladen hat nicht geklappt", {
          description: result.error ?? "Die Datei ist evtl. zu groß.",
          duration: 5000,
        });
        return;
      }
      toast.success(
        result.uploaded === 1 ? "Datei hochgeladen" : `${result.uploaded} Dateien hochgeladen`,
        {
          duration: 3000,
        },
      );
      router.refresh();
    } catch (error) {
      console.error("[team-files:upload]", error);
      toast.error("Hochladen hat nicht geklappt", { duration: 5000 });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {files.length ? (
        <ul className="divide-y divide-border/60">
          {files.map((file) => {
            const Icon = file.mimeType.startsWith("image/") ? ImageIcon : FileIcon;
            const canDelete = canManage || file.uploaderId === viewerId;
            return (
              <li key={file.id} className="flex min-h-12 items-center gap-2 py-1">
                <a
                  href={`/api/departments/${encodeURIComponent(departmentId)}/documents/${encodeURIComponent(file.id)}`}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-md py-1 hover:text-primary"
                >
                  <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{file.fileName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[
                        formatFileLibraryFileSize(file.fileSize),
                        file.uploaderName,
                        DATE.format(new Date(file.createdAt)),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </a>
                {canDelete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0"
                    aria-label={`${file.fileName} löschen`}
                    onClick={() => setDeleting(file)}
                  >
                    <XIcon className="h-4 w-4" />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-3 text-center text-sm text-muted-foreground">
          Noch keine Dateien – z. B. Skizzen, Maßlisten, Stofflisten oder Pläne.
        </p>
      )}
      {canUpload ? (
        <>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.txt,audio/*"
            onChange={(event) => void upload(event.target.files)}
          />
          <AsyncButton
            type="button"
            variant="outline"
            className="h-11 w-full sm:w-auto"
            isLoading={uploading}
            loadingText="Lädt hoch …"
            onClick={() => inputRef.current?.click()}
          >
            <UploadIcon className="h-4 w-4" aria-hidden />
            Datei hochladen
          </AsyncButton>
          <p className="text-xs text-muted-foreground">
            Bilder, PDF, Office, Text oder Audio, je bis 15 MB.
          </p>
        </>
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Datei löschen?"
        description={
          deleting ? `„${deleting.fileName}“ wird für das ganze Gewerk entfernt.` : undefined
        }
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          const file = deleting;
          setDeleting(null);
          if (!file) return;
          const result = await deleteTeamFileAction({ id: file.id });
          if (!result.ok) {
            toast.error("Das hat nicht geklappt", { description: result.error, duration: 5000 });
            return;
          }
          toast.success("Datei gelöscht", { duration: 3000 });
          router.refresh();
        }}
      />
    </div>
  );
}
