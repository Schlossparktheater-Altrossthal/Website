"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { searchProductsAction } from "@/app/(members)/mitglieder/lager/actions/assets";
import { updateSetComponentsAction } from "@/app/(members)/mitglieder/lager/actions/sets";
import { AssetThumb } from "@/components/inventory/asset-thumb";
import { PlusIcon, SearchIcon, TrashIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProductKind } from "@/lib/inventory/constants";
import type { ProductSearchHit } from "@/lib/inventory/queries";

export type SetComponentDraft = {
  productId: string;
  name: string;
  kind: ProductKind;
  photoId: string | null;
  quantity: number;
};

/** Bestandteile eines Sets wählen: Artikel suchen, Menge je Set festlegen. */
export function SetComponentsField({
  value,
  onChange,
  excludeId,
}: {
  value: SetComponentDraft[];
  onChange: (value: SetComponentDraft[]) => void;
  excludeId?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<ProductSearchHit[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(
      async () => {
        const response = await searchProductsAction(query);
        if (!cancelled) setHits(response.ok ? response.data : []);
      },
      query ? 200 : 0,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const add = (hit: ProductSearchHit) => {
    const existing = value.find((entry) => entry.productId === hit.id);
    onChange(
      existing
        ? value.map((entry) =>
            entry.productId === hit.id ? { ...entry, quantity: entry.quantity + 1 } : entry,
          )
        : [
            ...value,
            {
              productId: hit.id,
              name: hit.name,
              kind: hit.kind,
              photoId: hit.photoId,
              quantity: 1,
            },
          ],
    );
  };
  const choices = hits.filter((hit) => hit.kind !== "set" && hit.id !== excludeId);

  return (
    <div className="space-y-3">
      {value.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {value.map((entry) => (
            <li key={entry.productId} className="flex items-center gap-3 px-3 py-2">
              <AssetThumb photoId={entry.photoId} kind={entry.kind} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {entry.name}
              </span>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={entry.quantity}
                onChange={(event) =>
                  onChange(
                    value.map((item) =>
                      item.productId === entry.productId
                        ? { ...item, quantity: Math.max(1, Number(event.target.value) || 1) }
                        : item,
                    ),
                  )
                }
                className="h-9 w-16 text-right tabular-nums"
                aria-label={`Anzahl ${entry.name} je Set`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-destructive"
                aria-label={`${entry.name} entfernen`}
                onClick={() => onChange(value.filter((item) => item.productId !== entry.productId))}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Noch keine Bestandteile.</p>
      )}
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Bestandteil suchen, z. B. Taschensender"
          className="pl-9"
          aria-label="Bestandteil suchen"
        />
      </div>
      <ul className="max-h-60 divide-y divide-border overflow-y-auto rounded-md border border-border">
        {choices.map((hit) => (
          <li key={hit.id}>
            <button
              type="button"
              onClick={() => add(hit)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
            >
              <AssetThumb photoId={hit.photoId} kind={hit.kind} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {hit.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[hit.areaName, hit.categoryPath].filter(Boolean).join(" · ")}
                </span>
              </span>
              <PlusIcon className="h-4 w-4 shrink-0 text-primary" />
            </button>
          </li>
        ))}
        {!choices.length ? (
          <li className="px-3 py-2 text-sm text-muted-foreground">
            Nichts gefunden – Bestandteile müssen erst als Artikel erfasst sein.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

/** Auf der Set-Seite: Bestandteile ändern und speichern. */
export function SetComponentsEditor({
  setId,
  initial,
}: {
  setId: string;
  initial: SetComponentDraft[];
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  if (!editing) {
    return (
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        Bestandteile ändern
      </Button>
    );
  }
  return (
    <div className="space-y-3 rounded-lg border border-primary/40 p-3">
      <SetComponentsField value={value} onChange={setValue} excludeId={setId} />
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={saving || !value.length}
          onClick={async () => {
            setSaving(true);
            const result = await updateSetComponentsAction(
              setId,
              value.map((entry) => ({ productId: entry.productId, quantity: entry.quantity })),
            );
            setSaving(false);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success(result.message ?? "Gespeichert.");
            setEditing(false);
            router.refresh();
          }}
        >
          {saving ? "Speichert …" : "Speichern"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setValue(initial);
            setEditing(false);
          }}
        >
          Abbrechen
        </Button>
      </div>
    </div>
  );
}
