"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  ChevronRightIcon,
  DownloadIcon,
  FileIcon,
  RefreshIcon,
  SparklesIcon,
  TrashIcon,
  UploadIcon,
  UsersIcon,
} from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ListRow, ListRowGroup } from "@/components/ui/list-row";

import { deletePendingScriptAction, retryPendingScriptAction } from "../../actions/skript";

import { inputClass } from "../ui";
import { byline, formatDateTime } from "./format";

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
  hasSource: boolean;
};

/** Hochgeladenes PDF, an dem sich der Parser noch die Zähne ausbeißt. */
export type ScriptPendingItem = {
  id: string;
  label: string;
  sourceName: string;
  error: string;
  attempts: number;
  lastTriedAt: string;
  createdAt: string;
  createdByName: string | null;
};

const BASE = "/mitglieder/produktionen/stueck?ansicht=skript";

export function ScriptVersions({
  showId,
  versions,
  pending,
  canManage,
  takeoverSummary = null,
}: {
  showId: string;
  versions: ScriptVersionItem[];
  pending: ScriptPendingItem[];
  canManage: boolean;
  /** Was die aktuelle Fassung fürs Stück noch ändern würde; leer = nichts, null = keine Fassung. */
  takeoverSummary?: string | null;
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
      {canManage && versions.length ? (
        <ListRowGroup variant="inset">
          <ListRow
            href={`${BASE}&bereich=rollen`}
            leading={<UsersIcon className="h-5 w-5 text-muted-foreground" aria-hidden />}
            title="Rollen zuordnen"
            description="Stück-Rollen, Zusammenführen, Gruppen wie „Alle“"
          />
          {versions.some((version) => version.status === "released") ? (
            <ListRow
              href={`${BASE}&bereich=uebernahme`}
              leading={<FileIcon className="h-5 w-5 text-muted-foreground" aria-hidden />}
              title={
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">Ins Stück übernehmen</span>
                  {takeoverSummary ? (
                    <Badge variant="warning" size="sm">
                      Änderungen
                    </Badge>
                  ) : null}
                </span>
              }
              description={
                takeoverSummary
                  ? `Fürs Stück offen: ${takeoverSummary}`
                  : "Stück ist auf dem Stand der aktuellen Fassung"
              }
            />
          ) : null}
        </ListRowGroup>
      ) : null}
      {canManage ? <ScriptUpload showId={showId} /> : null}
      {pending.map((item) => (
        <PendingCard key={item.id} showId={showId} item={item} />
      ))}
      {versions.length ? (
        <ListRowGroup>
          {versions.map((version) => (
            <div key={version.id} className="flex items-center gap-1">
              <ListRow
                className="flex-1"
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
              {version.hasSource ? (
                <Button asChild size="icon" variant="ghost" className="shrink-0">
                  <a
                    href={originalUrl(showId, "fassung", version.id)}
                    download
                    aria-label={`Original-PDF „${version.sourceName}“ herunterladen`}
                    title="Original-PDF herunterladen"
                  >
                    <DownloadIcon aria-hidden />
                  </a>
                </Button>
              ) : null}
            </div>
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

export function originalUrl(showId: string, kind: "fassung" | "upload", id: string) {
  return `/api/skript/${showId}/original?${kind}=${encodeURIComponent(id)}`;
}

/** Freundlicher Platzhalter für ein PDF, das der Parser (noch) nicht versteht. */
function PendingCard({ showId, item }: { showId: string; item: ScriptPendingItem }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const retry = async () => {
    setBusy(true);
    const result = await retryPendingScriptAction(item.id);
    setBusy(false);
    if (!result.ok) {
      toast.error("Noch nicht lesbar", { description: result.error, duration: 6000 });
      router.refresh();
      return;
    }
    toast.success(result.message ?? "Entwurf angelegt");
    router.push(`${BASE}&fassung=${result.id}`);
  };

  return (
    <Card className="border-warning/50 bg-warning/5">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 break-words">{item.label}</span>
          <Badge variant="warning" size="sm">
            Wartet auf den Parser
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>
          🎭 Unser Skript-Parser hat bei diesem PDF ins Leere gegriffen – Texthänger sozusagen.
          Keine Sorge: Das Original ist sicher verwahrt, und die Admins bringen dem Parser gerade
          bei, diese Fassung zu lesen. Danach einfach „Erneut einlesen“ tippen.
        </p>
        <p className="text-muted-foreground">
          Hochgeladen von {byline(item.createdByName, item.createdAt)} · {item.sourceName}
          {item.attempts > 1
            ? ` · ${item.attempts} Versuche, zuletzt ${formatDateTime(item.lastTriedAt)}`
            : ""}
        </p>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Für die Admins</summary>
          <code className="mt-1 block break-all">{item.error}</code>
        </details>
        <div className="flex flex-wrap gap-2">
          <AsyncButton size="sm" isLoading={busy} loadingText="Liest …" onClick={retry}>
            <RefreshIcon aria-hidden /> Erneut einlesen
          </AsyncButton>
          <Button asChild size="sm" variant="outline">
            <a href={originalUrl(showId, "upload", item.id)} download>
              <DownloadIcon aria-hidden /> Original-PDF
            </a>
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>
            <TrashIcon aria-hidden /> Verwerfen
          </Button>
        </div>
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Upload verwerfen?"
          description="Das aufgehobene PDF wird gelöscht."
          confirmLabel="Verwerfen"
          cancelLabel="Abbrechen"
          variant="destructive"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setConfirmDelete(false);
            const result = await deletePendingScriptAction(item.id);
            if (!result.ok) toast.error(result.error);
            else router.refresh();
          }}
        />
      </CardContent>
    </Card>
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
      if (response.status === 202) {
        toast.warning("Skript aufgehoben", {
          description:
            "Unser Parser kommt mit diesem PDF noch nicht klar – die Admins kümmern sich.",
          duration: 8000,
        });
        setFile(null);
        setLabel("");
        setDate("");
        router.refresh();
        return;
      }
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
