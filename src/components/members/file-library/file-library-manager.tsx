"use client";

import { useMemo, useRef, useState } from "react";
import { FileText, Loader2, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  FILE_LIBRARY_ACCEPT_MIME_TYPES,
  MAX_FILE_LIBRARY_DESCRIPTION_LENGTH,
  MAX_FILE_LIBRARY_FILE_BYTES,
  MAX_FILE_LIBRARY_FILES_PER_UPLOAD,
  formatFileLibraryFileSize,
} from "@/lib/file-library";

const ACCEPT_SET = new Set(FILE_LIBRARY_ACCEPT_MIME_TYPES.map((entry) => entry.toLowerCase()));

export type FileLibraryItemEntry = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  description: string | null;
  createdAt: string;
  uploadedBy: {
    id: string | null;
    name: string | null;
    email: string | null;
  } | null;
  downloadUrl: string;
  canDelete: boolean;
};

type FileLibraryManagerProps = {
  folderId: string;
  canUpload: boolean;
  canDownload: boolean;
  canManage: boolean;
  initialItems: FileLibraryItemEntry[];
};

type UploadCandidate = {
  file: File;
  key: string;
  description: string;
};

function getFileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function mergeItems(existing: FileLibraryItemEntry[], incoming: FileLibraryItemEntry[]) {
  const map = new Map<string, FileLibraryItemEntry>();
  for (const item of incoming) {
    map.set(item.id, item);
  }
  for (const item of existing) {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    return timeB - timeA;
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "Unbekannt";
  }
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function resolveUploaderLabel(uploadedBy: FileLibraryItemEntry["uploadedBy"]) {
  if (!uploadedBy) {
    return "Unbekannt";
  }
  return uploadedBy.name?.trim() || uploadedBy.email?.trim() || "Unbekannt";
}

function isFileLike(value: unknown): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as File).arrayBuffer === "function" &&
    typeof (value as File).size === "number"
  );
}

export function FileLibraryManager({ folderId, canUpload, canDownload, canManage, initialItems }: FileLibraryManagerProps) {
  const [items, setItems] = useState<FileLibraryItemEntry[]>(() =>
    [...initialItems].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  );
  const [selectedFiles, setSelectedFiles] = useState<UploadCandidate[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragCounterRef = useRef(0);

  const selectedTotalSize = useMemo(
    () => selectedFiles.reduce((total, entry) => total + entry.file.size, 0),
    [selectedFiles],
  );

  const handleFileSelection = (incoming: File[]) => {
    if (!incoming.length) {
      return;
    }

    const nextFiles: UploadCandidate[] = [];
    const rejected: string[] = [];
    const existingKeys = new Set(selectedFiles.map((entry) => entry.key));

    for (const file of incoming) {
      const key = getFileKey(file);
      if (existingKeys.has(key)) {
        continue;
      }

      if (file.size > MAX_FILE_LIBRARY_FILE_BYTES) {
        rejected.push(
          `${file.name}: Datei ist zu groß (maximal ${Math.floor(MAX_FILE_LIBRARY_FILE_BYTES / (1024 * 1024))} MB).`,
        );
        continue;
      }

      const normalizedMime = file.type?.trim().toLowerCase();
      if (normalizedMime && ACCEPT_SET.size && !ACCEPT_SET.has(normalizedMime)) {
        rejected.push(`${file.name}: Dateityp wird nicht unterstützt.`);
        continue;
      }

      nextFiles.push({ file, key, description: "" });
      existingKeys.add(key);
    }

    if (rejected.length) {
      toast.error(rejected.join(" "));
    }

    if (!nextFiles.length) {
      return;
    }

    setSelectedFiles((previous) => {
      const merged = [...previous, ...nextFiles];
      if (merged.length > MAX_FILE_LIBRARY_FILES_PER_UPLOAD) {
        toast.error(`Es können maximal ${MAX_FILE_LIBRARY_FILES_PER_UPLOAD} Dateien pro Upload ausgewählt werden.`);
        return merged.slice(0, MAX_FILE_LIBRARY_FILES_PER_UPLOAD);
      }
      return merged;
    });
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(event.target.files ?? []);
    if (list.length) {
      handleFileSelection(list);
    }
    event.target.value = "";
  };

  const handleRemoveCandidate = (key: string) => {
    setSelectedFiles((previous) => previous.filter((entry) => entry.key !== key));
  };

  const handleDescriptionChange = (key: string, value: string) => {
    setSelectedFiles((previous) =>
      previous.map((entry) =>
        entry.key === key
          ? { ...entry, description: value.slice(0, MAX_FILE_LIBRARY_DESCRIPTION_LENGTH) }
          : entry,
      ),
    );
  };

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFiles.length) {
      toast.error("Bitte wähle mindestens eine Datei aus.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach((entry) => {
        formData.append("files", entry.file);
        formData.append("descriptions", entry.description ?? "");
      });

      const response = await fetch(`/api/file-library/folders/${folderId}`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Upload fehlgeschlagen.");
      }

      const uploaded = Array.isArray(data?.items) ? (data.items as FileLibraryItemEntry[]) : [];
      setItems((previous) => mergeItems(previous, uploaded));
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (uploaded.length) {
        toast.success(
          uploaded.length === 1 ? "Datei wurde hochgeladen." : `${uploaded.length} Dateien wurden hochgeladen.`,
        );
      } else {
        toast.success("Upload abgeschlossen.");
      }
    } catch (error) {
      console.error("[file-library] upload", error);
      toast.error(error instanceof Error ? error.message : "Upload fehlgeschlagen.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/file-library/items/${id}`, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Löschen fehlgeschlagen.");
      }
      setItems((previous) => previous.filter((item) => item.id !== id));
      toast.success("Datei wurde entfernt.");
    } catch (error) {
      console.error("[file-library] delete", error);
      toast.error(error instanceof Error ? error.message : "Löschen fehlgeschlagen.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragCounterRef.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const files = Array.from(event.dataTransfer.files ?? []).filter(isFileLike);
    if (files.length) {
      handleFileSelection(files);
    }
  };

  return (
    <div className="space-y-6">
      {canUpload ? (
        <Card>
          <CardHeader>
            <CardTitle>Dateien hochladen</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              <div
                className={cn(
                  "flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border/70 bg-muted/40 p-6 text-center",
                  isDragging && "border-primary bg-primary/10",
                )}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <UploadCloud className="h-8 w-8 text-muted-foreground" aria-hidden />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Dateien hierhin ziehen oder auswählen</p>
                  <p className="text-xs text-muted-foreground">
                    Unterstützte Formate: {FILE_LIBRARY_ACCEPT_MIME_TYPES.join(", ")}. Maximal {MAX_FILE_LIBRARY_FILES_PER_UPLOAD}
                    {" "}
                    Dateien pro Upload, je bis {Math.floor(MAX_FILE_LIBRARY_FILE_BYTES / (1024 * 1024))} MB.
                  </p>
                </div>
                <div>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={FILE_LIBRARY_ACCEPT_MIME_TYPES.join(",")}
                    onChange={handleFileInputChange}
                    className="hidden"
                    id="file-library-upload"
                  />
                  <Label htmlFor="file-library-upload">
                    <span className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
                      Dateien auswählen
                    </span>
                  </Label>
                </div>
              </div>

              {selectedFiles.length ? (
                <div className="space-y-3 rounded-md border border-border/60 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span>{selectedFiles.length} Dateien ausgewählt</span>
                    <span className="text-muted-foreground">Gesamt: {formatFileLibraryFileSize(selectedTotalSize)}</span>
                  </div>
                  <div className="space-y-4">
                    {selectedFiles.map((entry) => (
                      <div key={entry.key} className="space-y-2 rounded-md border border-border/50 p-3">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-medium">{entry.file.name}</span>
                          <Button type="button" size="sm" variant="ghost" onClick={() => handleRemoveCandidate(entry.key)}>
                            Entfernen
                          </Button>
                        </div>
                        <Textarea
                          placeholder="Optionale Beschreibung"
                          value={entry.description}
                          maxLength={MAX_FILE_LIBRARY_DESCRIPTION_LENGTH}
                          onChange={(event) => handleDescriptionChange(entry.key, event.target.value)}
                          rows={2}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={uploading}>
                      {uploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Upload läuft…
                        </>
                      ) : (
                        "Upload starten"
                      )}
                    </Button>
                  </div>
                </div>
              ) : null}
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Bestehende Dateien</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.length ? (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex flex-col gap-3 rounded-md border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-1 items-start gap-3">
                    <FileText className="mt-1 h-5 w-5 text-muted-foreground" aria-hidden />
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{item.fileName}</p>
                      {item.description ? (
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        {formatFileLibraryFileSize(item.fileSize)} · {formatDateTime(item.createdAt)} · {resolveUploaderLabel(item.uploadedBy)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canDownload ? (
                      <Button asChild size="sm" variant="outline">
                        <a href={item.downloadUrl} target="_blank" rel="noreferrer">
                          Herunterladen
                        </a>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled>
                        Herunterladen
                      </Button>
                    )}
                    {(canManage || item.canDelete) && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        aria-label="Datei löschen"
                      >
                        {deletingId === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Es wurden noch keine Dateien hochgeladen.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
