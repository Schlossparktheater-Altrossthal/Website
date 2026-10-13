"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ChevronRightIcon, FileIcon, SparklesIcon, UploadIcon } from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";

import { inputClass } from "../ui";
import { byline } from "./format";

export type ScriptVersionItem = {
  id: string;
  label: string;
  status: "draft" | "released";
  sourceName: string;
  createdAt: string;
  createdByName: string | null;
  releasedAt: string | null;
  releasedByName: string | null;
  scenes: number;
  blocks: number;
  roles: number;
};

const BASE = "/mitglieder/produktionen/stueck?ansicht=skript";

export function ScriptVersions({
  showId,
  versions,
  canManage,
}: {
  showId: string;
  versions: ScriptVersionItem[];
  canManage: boolean;
}) {
  return (
    <div className="space-y-4">
      {versions.some((version) => version.status === "released") ? (
        <Link
          href={`/mitglieder/lernen/${showId}`}
          className="flex min-h-14 items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 hover:bg-primary/15"
        >
          <SparklesIcon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Text lernen</span>
            <span className="block text-sm text-muted-foreground">
              Szenen durchspielen und abfragen – mit Wiederholung zur richtigen Zeit
            </span>
          </span>
          <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
      ) : null}
      {canManage ? <ScriptUpload showId={showId} /> : null}
      {versions.length ? (
        <ListRowGroup>
          {versions.map((version) => (
            <ListRow
              key={version.id}
              href={
                version.status === "released"
                  ? `/mitglieder/skript/${version.id}`
                  : `${BASE}&fassung=${version.id}`
              }
              leading={<FileIcon className="h-5 w-5 text-muted-foreground" aria-hidden />}
              title={
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="break-words">{version.label}</span>
                  {version.status === "draft" ? (
                    <Badge variant="warning" size="sm">
                      Entwurf
                    </Badge>
                  ) : (
                    <Badge variant="success" size="sm">
                      Freigegeben
                    </Badge>
                  )}
                </span>
              }
              description={
                <>
                  {version.scenes} Szenen · {version.blocks} Absätze · {version.roles} Rollen
                  <br />
                  {version.releasedAt
                    ? `Freigegeben von ${byline(version.releasedByName, version.releasedAt)}`
                    : `Eingelesen von ${byline(version.createdByName, version.createdAt)}`}
                </>
              }
            />
          ))}
        </ListRowGroup>
      ) : (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {canManage
            ? "Noch kein Skript eingelesen. Lade oben das PDF der Regie hoch."
            : "Es ist noch keine Fassung des Skripts freigegeben."}
        </p>
      )}
    </div>
  );
}

function ScriptUpload({ showId }: { showId: string }) {
  const router = useRouter();
  const [file, setFile] = React.useState<File | null>(null);
  const [label, setLabel] = React.useState("");
  const [date, setDate] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    const form = new FormData();
    form.set("file", file);
    if (label.trim()) form.set("label", label.trim());
    if (date) form.set("versionDate", date);
    try {
      const response = await fetch(`/api/skript/${showId}`, { method: "POST", body: form });
      const body = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!response.ok || !body.id) {
        toast.error("Einlesen fehlgeschlagen", { description: body.error, duration: 6000 });
        return;
      }
      toast.success("Skript eingelesen", {
        description: "Bitte jetzt Rollen und Hinweise prüfen.",
      });
      router.push(`${BASE}&fassung=${body.id}`);
    } catch {
      toast.error("Einlesen fehlgeschlagen", { description: "Keine Verbindung zum Server." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Neue Fassung einlesen</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <span className="text-sm font-medium">PDF der Regie</span>
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
                <FileIcon aria-hidden /> PDF auswählen
              </Button>
              <span className="min-w-0 break-all text-sm text-muted-foreground">
                {file ? file.name : "Noch keine Datei gewählt"}
              </span>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              aria-label="PDF der Regie"
              className="sr-only"
              onChange={(event) => {
                const next = event.target.files?.[0] ?? null;
                setFile(next);
                if (next && !label) setLabel(next.name.replace(/\.pdf$/i, "").replace(/_/g, " "));
              }}
            />
          </div>
          <label className="space-y-1">
            <span className="text-sm font-medium">Bezeichnung</span>
            <input
              className={inputClass}
              value={label}
              maxLength={200}
              placeholder="z. B. Stand 15.6."
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Stand vom</span>
            <input
              type="date"
              className={inputClass}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <AsyncButton
              type="submit"
              isLoading={busy}
              loadingText="Wird eingelesen …"
              disabled={!file}
            >
              <UploadIcon aria-hidden /> Einlesen
            </AsyncButton>
            <span className="text-xs text-muted-foreground">
              Es entsteht ein Entwurf; das Ensemble sieht ihn erst nach der Freigabe.
            </span>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
