"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ProductionObjectKind } from "@prisma/client";
import { format } from "date-fns";
import { de } from "date-fns/locale/de";
import { toast } from "sonner";

import { CameraIcon, ChevronRightIcon } from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { OBJECT_KIND_LABELS, OBJECT_KINDS, OBJECT_TEXT_LIMITS } from "@/lib/ausstattung/constants";
import type { InboxItem } from "@/lib/ausstattung/objects";
import { cn } from "@/lib/utils";

import { decideRequirementAction } from "../ausstattung-actions";
import { inputClass } from "./shared";

type Mode = "new" | "existing" | "decline";

export type InboxObjectOption = { id: string; title: string; kind: ProductionObjectKind };

/** Eingang: Anforderungen aus den Szenen, vor dem Board. */
export function RequirementInbox({
  items,
  objects,
  basePath,
  canEdit,
}: {
  items: InboxItem[];
  objects: InboxObjectOption[];
  basePath: string;
  canEdit: boolean;
}) {
  const [open, setOpen] = React.useState<InboxItem | null>(null);
  if (!items.length) return null;
  return (
    <section
      aria-labelledby="inbox-heading"
      className="space-y-2 rounded-xl border border-info/40 bg-info/5 p-3"
    >
      <h2 id="inbox-heading" className="flex items-center gap-2 text-sm font-semibold">
        Eingang
        <span className="rounded-full bg-info px-2 py-0.5 text-xs text-info-foreground">
          {items.length}
        </span>
        <span className="text-xs font-normal text-muted-foreground">Anforderungen aus Szenen</span>
      </h2>
      <ul className="grid gap-2 lg:grid-cols-2">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => setOpen(item)}
              className="flex w-full items-start gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:bg-muted/40 disabled:cursor-default"
            >
              <span className="min-w-0 flex-1 space-y-0.5">
                <span className="block text-xs text-muted-foreground">
                  {OBJECT_KIND_LABELS[item.kind]} · {item.sceneLabel}
                  {item.characterName ? ` · ${item.characterName}` : ""}
                </span>
                <span className="line-clamp-3 block whitespace-pre-wrap text-sm">{item.text}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {item.requestedBy ?? "Unbekannt"} ·{" "}
                  {format(new Date(item.createdAt), "d. MMM", { locale: de })}
                  {item.hasPhoto ? (
                    <CameraIcon className="h-3.5 w-3.5" aria-label="mit Foto" />
                  ) : null}
                </span>
              </span>
              {canEdit ? (
                <ChevronRightIcon className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      <DecidePanel
        item={open}
        objects={objects}
        basePath={basePath}
        onClose={() => setOpen(null)}
      />
    </section>
  );
}

function DecidePanel({
  item,
  objects,
  basePath,
  onClose,
}: {
  item: InboxItem | null;
  objects: InboxObjectOption[];
  basePath: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>("new");
  const [title, setTitle] = React.useState("");
  const [kind, setKind] = React.useState<ProductionObjectKind>("prop");
  const [objectId, setObjectId] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [key, setKey] = React.useState<string | null>(null);
  if (item && key !== item.id) {
    setKey(item.id);
    setMode("new");
    setTitle(suggestTitle(item.text));
    setKind(item.kind);
    setObjectId("");
    setQuery("");
    setReason("");
  }

  const needle = query.trim().toLowerCase();
  const candidates = objects
    .filter((object) => !needle || object.title.toLowerCase().includes(needle))
    .slice(0, 40);
  const valid = mode === "new" ? title.trim() : mode === "existing" ? objectId : reason.trim();

  const submit = async () => {
    if (!item) return;
    setSaving(true);
    const result = await decideRequirementAction(
      mode === "new"
        ? { mode, requirementId: item.id, title, kind }
        : mode === "existing"
          ? { mode, requirementId: item.id, objectId }
          : { mode, requirementId: item.id, reason },
    );
    setSaving(false);
    if (!result.ok) {
      toast.error("Das hat nicht geklappt", { description: result.error, duration: 5000 });
      return;
    }
    toast.success(mode === "decline" ? "Abgelehnt" : "Übernommen", { duration: 3000 });
    onClose();
    if (mode === "new" && result.data?.objectId) {
      router.push(`${basePath}/objekt/${result.data.objectId}`);
    } else {
      router.refresh();
    }
  };

  return (
    <ResponsivePanel
      open={Boolean(item)}
      onOpenChange={(value) => !value && onClose()}
      title="Anforderung"
      description="Anforderung aus der Szene entscheiden"
      footer={
        <AsyncButton
          type="button"
          variant={mode === "decline" ? "destructive" : "default"}
          className="h-11 w-full"
          isLoading={saving}
          disabled={!valid}
          onClick={submit}
        >
          {mode === "new" ? "Objekt anlegen" : mode === "existing" ? "Zuordnen" : "Ablehnen"}
        </AsyncButton>
      }
    >
      {item ? (
        <div className="space-y-4">
          <div className="space-y-1 rounded-lg bg-muted px-3 py-2">
            <p className="text-xs text-muted-foreground">
              {OBJECT_KIND_LABELS[item.kind]} · {item.sceneLabel}
              {item.characterName ? ` · ${item.characterName}` : ""} · von{" "}
              {item.requestedBy ?? "Unbekannt"}
            </p>
            <p className="whitespace-pre-wrap text-sm">{item.text}</p>
            {item.hasPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/ausstattung/anforderungen/${item.id}/foto`}
                alt="Foto zur Anforderung"
                className="mt-2 max-h-56 rounded-md object-contain"
              />
            ) : null}
          </div>

          <SegmentedControl<Mode>
            aria-label="Entscheidung"
            size="md"
            fullWidth
            value={mode}
            onValueChange={setMode}
            options={[
              { value: "new", label: "Neues Objekt" },
              { value: "existing", label: "Vorhanden", ariaLabel: "Vorhandenem Objekt zuordnen" },
              { value: "decline", label: "Ablehnen" },
            ]}
          />

          {mode === "new" ? (
            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Bezeichnung</span>
                <input
                  className={inputClass}
                  value={title}
                  maxLength={OBJECT_TEXT_LIMITS.title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-1.5">
                {OBJECT_KINDS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={kind === value}
                    onClick={() => setKind(value)}
                    className={cn(
                      "h-9 rounded-full border px-3 text-sm",
                      kind === value
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {OBJECT_KIND_LABELS[value]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Der Text wird zur Beschreibung, die Szene{item.characterName ? " und Rolle" : ""}{" "}
                werden verknüpft, ein Foto wird Referenzfoto. Die Karte landet in der ersten Spalte.
              </p>
            </div>
          ) : null}

          {mode === "existing" ? (
            <div className="space-y-2">
              <input
                className={inputClass}
                value={query}
                placeholder="Objekt suchen"
                aria-label="Objekt suchen"
                onChange={(event) => setQuery(event.target.value)}
              />
              {candidates.length ? (
                <ul className="max-h-64 space-y-1 overflow-y-auto">
                  {candidates.map((object) => (
                    <li key={object.id}>
                      <button
                        type="button"
                        aria-pressed={objectId === object.id}
                        onClick={() => setObjectId(object.id)}
                        className={cn(
                          "flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border px-3 text-left text-sm",
                          objectId === object.id
                            ? "border-primary bg-primary/10 font-medium text-primary"
                            : "border-border",
                        )}
                      >
                        <span className="truncate">{object.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {OBJECT_KIND_LABELS[object.kind]}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Kein passendes Objekt.</p>
              )}
              <p className="text-xs text-muted-foreground">
                Das Objekt bekommt diese Szene dazu – z. B. dasselbe Schwert wie in einer früheren
                Szene.
              </p>
            </div>
          ) : null}

          {mode === "decline" ? (
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                Grund (sieht die anfordernde Person)
              </span>
              <textarea
                className={cn(inputClass, "h-auto min-h-24 py-2")}
                value={reason}
                maxLength={OBJECT_TEXT_LIMITS.note}
                onChange={(event) => setReason(event.target.value)}
                placeholder="z. B. Budget reicht nicht, Alternative: …"
              />
            </label>
          ) : null}
        </div>
      ) : null}
    </ResponsivePanel>
  );
}

/** Titelvorschlag: erster Satzteil („Krone für Theseus zur Hochzeit – golden …“ → „Krone für Theseus zur Hochzeit“). */
function suggestTitle(text: string) {
  const first = text.split(/\n|[.!?](?:\s|$)|\s[–-]\s|,|:/)[0]?.trim() ?? "";
  return first.length > 60 ? `${first.slice(0, 57).trimEnd()} …` : first;
}
