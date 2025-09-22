"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Image as ImageIcon,
  Loader2,
  Trash2,
  UploadCloud,
  Video,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
  GALLERY_ACCEPT_MIME_TYPES,
  MAX_GALLERY_DESCRIPTION_LENGTH,
  MAX_GALLERY_FILE_BYTES,
  MAX_GALLERY_FILES_PER_UPLOAD,
  formatGalleryFileSize,
  resolveGalleryMediaKind,
} from "@/lib/gallery";

const IMAGE_MIME_SET = new Set<string>(ALLOWED_IMAGE_MIME_TYPES);
const VIDEO_MIME_SET = new Set<string>(ALLOWED_VIDEO_MIME_TYPES);

export type MemberGalleryItem = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  type: "image" | "video";
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

type MemberGalleryManagerProps = {
  year: number;
  canUpload: boolean;
  canModerate: boolean;
  initialItems: MemberGalleryItem[];
};

type UploadCandidate = {
  file: File;
  key: string;
  description: string;
  kind: "image" | "video";
};

function getFileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function mergeItems(
  existing: MemberGalleryItem[],
  incoming: MemberGalleryItem[],
): MemberGalleryItem[] {
  if (!incoming.length) {
    return existing;
  }
  const map = new Map<string, MemberGalleryItem>();
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
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getUploaderLabel(uploadedBy: MemberGalleryItem["uploadedBy"]) {
  if (!uploadedBy) {
    return "Unbekannt";
  }
  return uploadedBy.name?.trim() || uploadedBy.email?.trim() || "Unbekannt";
}

export function MemberGalleryManager({ year, canUpload, canModerate, initialItems }: MemberGalleryManagerProps) {
  const [items, setItems] = useState<MemberGalleryItem[]>(() => {
    return [...initialItems].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  });
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

  const stats = useMemo(() => {
    let imageCount = 0;
    let videoCount = 0;
    let totalSize = 0;
    let latest: Date | null = null;

    for (const item of items) {
      if (item.type === "image") {
        imageCount += 1;
      } else if (item.type === "video") {
        videoCount += 1;
      }
      totalSize += item.fileSize;
      const created = new Date(item.createdAt);
      if (!latest || created > latest) {
        latest = created;
      }
    }

    return {
      imageCount,
      videoCount,
      totalCount: items.length,
      totalSize,
      latest,
    };
  }, [items]);

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
      const kind = resolveGalleryMediaKind(file.type, file.name);
      if (!kind) {
        rejected.push(`${file.name}: Dateityp nicht unterstützt.`);
        continue;
      }

      const normalizedMime = file.type?.trim().toLowerCase();
      if (normalizedMime) {
        if (kind === "image" && !IMAGE_MIME_SET.has(normalizedMime)) {
          rejected.push(`${file.name}: Bildformat wird nicht unterstützt.`);
          continue;
        }
        if (kind === "video" && !VIDEO_MIME_SET.has(normalizedMime)) {
          rejected.push(`${file.name}: Videoformat wird nicht unterstützt.`);
          continue;
        }
      }

      if (file.size > MAX_GALLERY_FILE_BYTES) {
        rejected.push(
          `${file.name}: Datei ist zu groß (maximal ${Math.floor(MAX_GALLERY_FILE_BYTES / (1024 * 1024))} MB).`,
        );
        continue;
      }

      nextFiles.push({ file, key, description: "", kind });
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
      if (merged.length > MAX_GALLERY_FILES_PER_UPLOAD) {
        toast.error(`Es können maximal ${MAX_GALLERY_FILES_PER_UPLOAD} Dateien pro Upload ausgewählt werden.`);
        return merged.slice(0, MAX_GALLERY_FILES_PER_UPLOAD);
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
          ? { ...entry, description: value.slice(0, MAX_GALLERY_DESCRIPTION_LENGTH) }
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

      const response = await fetch(`/api/gallery/folders/${year}`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Upload fehlgeschlagen.");
      }

      const uploaded = Array.isArray(data?.items) ? (data.items as MemberGalleryItem[]) : [];
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
      console.error("[gallery] upload", error);
      toast.error(error instanceof Error ? error.message : "Upload fehlgeschlagen.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/gallery/items/${id}`, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Löschen fehlgeschlagen.");
      }
      setItems((previous) => previous.filter((item) => item.id !== id));
      toast.success("Upload wurde entfernt.");
    } catch (error) {
      console.error("[gallery] delete", error);
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
    const dropped = Array.from(event.dataTransfer.files ?? []);
    if (dropped.length) {
      handleFileSelection(dropped);
    }
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ordner {year}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
          <Badge variant="muted">
            <ImageIcon className="mr-1 h-3.5 w-3.5" /> {stats.imageCount} Bilder
          </Badge>
          <Badge variant="muted">
            <Video className="mr-1 h-3.5 w-3.5" /> {stats.videoCount} Videos
          </Badge>
          <Badge variant="muted">Gesamt {stats.totalCount}</Badge>
          <Badge variant="muted">Volumen {formatGalleryFileSize(stats.totalSize)}</Badge>
          <span>
            {stats.latest ? `Letzter Upload: ${formatDateTime(stats.latest.toISOString())}` : "Noch keine Uploads"}
          </span>
          {canModerate ? (
            <span className="basis-full text-xs font-medium text-success">
              Du darfst Uploads anderer Mitglieder entfernen.
            </span>
          ) : null}
        </CardContent>
      </Card>

      {canUpload ? (
        <Card id="upload">
          <CardHeader>
            <CardTitle className="text-lg">Neue Medien hochladen</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleUpload}>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <Label htmlFor="gallery-files">Dateien</Label>
                  <div
                    className={cn(
                      "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/60 bg-muted/10 px-4 py-8 text-center transition",
                      isDragging && "border-primary/60 bg-primary/10",
                    )}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    <UploadCloud className="h-10 w-10 text-primary" aria-hidden="true" />
                    <p className="text-sm font-medium text-foreground/90">
                      Dateien hierher ziehen oder auswählen
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        Dateien auswählen
                      </Button>
                      <Input
                        ref={fileInputRef}
                        id="gallery-files"
                        type="file"
                        multiple
                        accept={GALLERY_ACCEPT_MIME_TYPES}
                        onChange={handleFileInputChange}
                        className="sr-only"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Unterstützt JPG, PNG, WebP sowie MP4, MOV und WebM bis {Math.floor(MAX_GALLERY_FILE_BYTES / (1024 * 1024))} MB pro Datei.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Ausgewählte Dateien</Label>
                  {selectedFiles.length ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between text-sm text-muted-foreground">
                        <span>{selectedFiles.length} Datei{selectedFiles.length === 1 ? "" : "en"} ausgewählt</span>
                        <span>{formatGalleryFileSize(selectedTotalSize)}</span>
                      </div>
                      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                        {selectedFiles.map((entry) => (
                          <div key={entry.key} className="rounded-md border border-border/50 bg-card/60 p-3 text-left">
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-foreground/90">{entry.file.name}</p>
                                <p className="text-xs text-muted-foreground">
                        {formatGalleryFileSize(entry.file.size)} · {entry.kind === "video" ? "Video" : "Bild"}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground"
                                onClick={() => handleRemoveCandidate(entry.key)}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            </div>
                            <div className="mt-3 space-y-1">
                              <Label htmlFor={`desc-${entry.key}`} className="text-xs text-muted-foreground">
                                Kurzbeschreibung (optional)
                              </Label>
                              <Textarea
                                id={`desc-${entry.key}`}
                                rows={2}
                                maxLength={MAX_GALLERY_DESCRIPTION_LENGTH}
                                value={entry.description}
                                onChange={(event) => handleDescriptionChange(entry.key, event.target.value)}
                              />
                              <div className="text-right text-[11px] text-muted-foreground">
                                {entry.description.length}/{MAX_GALLERY_DESCRIPTION_LENGTH}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-md border border-dashed border-border/50 bg-muted/30 p-4 text-sm text-muted-foreground">
                      <AlertCircle className="h-4 w-4" aria-hidden="true" />
                      Noch keine Dateien ausgewählt.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-muted-foreground">
                  Es können bis zu {MAX_GALLERY_FILES_PER_UPLOAD} Dateien pro Upload übertragen werden.
                </span>
                <div className="flex items-center gap-2">
                  {selectedFiles.length ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedFiles([])}
                      disabled={uploading}
                    >
                      Auswahl leeren
                    </Button>
                  ) : null}
                  <Button type="submit" disabled={uploading || selectedFiles.length === 0}>
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Upload läuft
                      </>
                    ) : (
                      "Upload starten"
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Alle Medien</h2>
        {items.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-sm text-muted-foreground">
              In diesem Ordner wurden noch keine Dateien abgelegt.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <div className="relative aspect-video bg-muted">
                  {item.type === "image" ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.downloadUrl}
                        alt={item.fileName}
                        className="h-full w-full object-cover"
                      />
                    </>
                  ) : (
                    <video
                      controls
                      preload="metadata"
                      src={item.downloadUrl}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <CardContent className="space-y-3 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground/90">{item.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatGalleryFileSize(item.fileSize)} · {formatDateTime(item.createdAt)}
                      </p>
                    </div>
                    <Badge variant="muted">{item.type === "video" ? "Video" : "Bild"}</Badge>
                  </div>
                  {item.description ? (
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">von {getUploaderLabel(item.uploadedBy)}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <a href={item.downloadUrl} target="_blank" rel="noopener noreferrer">
                        Öffnen
                      </a>
                    </Button>
                    {item.canDelete || canModerate ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                      >
                        {deletingId === item.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="mr-2 h-4 w-4" />
                        )}
                        Entfernen
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
