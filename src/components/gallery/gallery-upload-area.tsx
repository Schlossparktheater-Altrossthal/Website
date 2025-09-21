"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type GalleryUploadAreaProps = {
  years: number[];
  headingId?: string;
};

type UploadStatus = "idle" | "uploading" | "success" | "error";

type UploadSummary = {
  count: number;
  year: string;
};

export function GalleryUploadArea({ years, headingId }: GalleryUploadAreaProps) {
  const [selectedYear, setSelectedYear] = useState(() =>
    years[0] ? years[0].toString() : "",
  );
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragCounterRef = useRef(0);
  const summaryRef = useRef<UploadSummary | null>(null);

  useEffect(() => {
    if (!years.length) {
      setSelectedYear("");
      return;
    }

    setSelectedYear((previous) => {
      if (!previous) {
        return years[0].toString();
      }

      const stillExists = years.some((entry) => entry.toString() === previous);
      return stillExists ? previous : years[0].toString();
    });
  }, [years]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const yearOptions = useMemo(() => years.map((year) => year.toString()), [years]);

  const handleFileSelection = (incoming: File[]) => {
    if (!incoming.length) {
      return;
    }

    const imageFiles = incoming.filter((file) =>
      file.type.startsWith("image/") || file.type === "",
    );

    if (!imageFiles.length) {
      setStatus("error");
      setMessage("Bitte wähle gültige Bilddateien aus.");
      return;
    }

    setFiles((previous) => mergeFiles(previous, imageFiles));
    setStatus("idle");
    setMessage(null);
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFiles = Array.from(event.target.files ?? []);

    if (!nextFiles.length) {
      return;
    }

    handleFileSelection(nextFiles);
    event.target.value = "";
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
    if (!dropped.length) {
      return;
    }

    handleFileSelection(dropped);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedYear) {
      setStatus("error");
      setMessage("Bitte wähle einen Zielordner aus.");
      return;
    }

    if (files.length === 0) {
      setStatus("error");
      setMessage("Bitte wähle mindestens ein Bild aus.");
      return;
    }

    const label = files.length === 1 ? "Bild" : "Bilder";
    const yearLabel = selectedYear;

    summaryRef.current = { count: files.length, year: yearLabel };
    setStatus("uploading");
    setMessage(`Lade ${files.length} ${label} in den Ordner ${yearLabel} ...`);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      const summary = summaryRef.current;
      setStatus("success");

      if (summary) {
        const summaryLabel = summary.count === 1 ? "Bild" : "Bilder";
        setMessage(
          `Fertig! ${summary.count} ${summaryLabel} wurden dem Ordner ${summary.year} hinzugefügt.`,
        );
      } else {
        setMessage("Upload abgeschlossen.");
      }

      setFiles([]);
      summaryRef.current = null;
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }, 1200);
  };

  const handleReset = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setFiles([]);
    setStatus("idle");
    setMessage(null);
    summaryRef.current = null;
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const removeFile = (fileKey: string) => {
    setFiles((previous) => previous.filter((file) => getFileKey(file) !== fileKey));
  };

  const hasFiles = files.length > 0;
  const totalSizeLabel = useMemo(() => {
    if (!hasFiles) {
      return null;
    }

    const totalSize = files.reduce((total, file) => total + file.size, 0);
    return formatFileSize(totalSize);
  }, [files, hasFiles]);

  const feedbackId = headingId ? `${headingId}-feedback` : undefined;

  return (
    <Card className="p-6 sm:p-8" role="region" aria-labelledby={headingId}>
      <div className="flex flex-col gap-6">
        <div className="space-y-2">
          <h2 id={headingId} className="text-2xl font-semibold text-primary sm:text-3xl">
            Upload-Bereich
          </h2>
          <p className="text-sm text-muted-foreground sm:text-base">
            Lade neue Fotostrecken hoch und ordne sie dem passenden Jahrgang zu. Deine Dateien bleiben in
            voller Auflösung erhalten und landen direkt im gemeinsamen Archiv.
          </p>
        </div>

        <form
          className="space-y-6"
          onSubmit={handleSubmit}
          aria-describedby={message ? feedbackId : undefined}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gallery-year">Zielordner</Label>
              <Select value={selectedYear} onValueChange={(value) => {
                setSelectedYear(value);
                setStatus("idle");
                setMessage(null);
              }}>
                <SelectTrigger id="gallery-year" aria-label="Jahrgangsordner auswählen">
                  <SelectValue placeholder="Jahr auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={year}>
                      Ordner {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Jeder Ordner ist für Produktionen, Premieren und Pressefotos des jeweiligen Jahres vorbereitet.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gallery-files">Bilder</Label>
              <div
                className={cn(
                  "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/60 bg-muted/15 px-4 py-6 text-center transition",
                  isDragging && "border-primary/60 bg-primary/10",
                )}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <UploadCloud aria-hidden="true" className="h-10 w-10 text-primary" />
                <p className="text-sm font-medium text-foreground/90">
                  Ziehe Bilder hierher oder wähle sie aus
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => inputRef.current?.click()}
                    className="font-semibold"
                  >
                    Dateien auswählen
                  </Button>
                  <Input
                    ref={inputRef}
                    id="gallery-files"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileInputChange}
                    className="sr-only"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Unterstützt JPG, PNG und WebP bis 25&nbsp;MB pro Datei.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">
                {hasFiles
                  ? `${files.length} Datei${files.length === 1 ? "" : "en"} ausgewählt`
                  : "Noch keine Dateien ausgewählt"}
              </p>
              {hasFiles ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="text-xs"
                >
                  Auswahl zurücksetzen
                </Button>
              ) : null}
            </div>

            {hasFiles ? (
              <ul className="space-y-2 text-sm text-muted-foreground">
                {files.map((file) => {
                  const key = getFileKey(file);
                  return (
                    <li
                      key={key}
                      className="flex items-center gap-3 rounded-md border border-border/50 bg-card/60 px-3 py-2"
                    >
                      <ImageIcon aria-hidden="true" className="h-5 w-5 text-primary/80" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground/90">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        aria-label={`${file.name} entfernen`}
                        onClick={() => removeFile(key)}
                      >
                        <X aria-hidden="true" className="h-4 w-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Du kannst mehrere Dateien gleichzeitig auswählen. Die Reihenfolge bleibt beim Hochladen erhalten.
              </p>
            )}

            {hasFiles && totalSizeLabel ? (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Gesamtgröße</span>
                <span>{totalSizeLabel}</span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={status === "uploading"} className="min-w-[12rem]">
              {status === "uploading" ? (
                <>
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  Upload läuft
                </>
              ) : (
                <>
                  <Upload aria-hidden="true" className="h-4 w-4" />
                  Upload starten
                </>
              )}
            </Button>
          </div>

          {message ? (
            <div
              id={feedbackId}
              className={cn(
                "flex items-center gap-2 text-sm font-medium",
                status === "success"
                  ? "text-success"
                  : status === "uploading"
                    ? "text-primary"
                    : status === "error"
                      ? "text-destructive"
                      : "text-muted-foreground",
              )}
            >
              {status === "success" ? (
                <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              ) : status === "uploading" ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : status === "error" ? (
                <AlertCircle aria-hidden="true" className="h-4 w-4" />
              ) : null}
              <span>{message}</span>
            </div>
          ) : null}
        </form>
      </div>
    </Card>
  );
}

function getFileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function mergeFiles(existing: File[], incoming: File[]) {
  const map = new Map<string, File>();
  for (const file of existing) {
    map.set(getFileKey(file), file);
  }
  for (const file of incoming) {
    map.set(getFileKey(file), file);
  }
  return Array.from(map.values());
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const maximumFractionDigits = size >= 10 || unitIndex === 0 ? 0 : 1;

  return `${size.toLocaleString("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  })} ${units[unitIndex]}`;
}
