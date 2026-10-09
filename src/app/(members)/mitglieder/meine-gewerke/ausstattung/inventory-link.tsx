"use client";

import * as React from "react";
import Link from "next/link";

import { SearchIcon, WarehouseIcon, XIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  linkFundusAction,
  listFundusAssetsAction,
  searchFundusAction,
  type FundusAsset,
  type FundusHit,
} from "../ausstattung-actions";
import { inputClass, useAction } from "./shared";

export type InventoryLinkProps = {
  objectId: string;
  canEdit: boolean;
  initial: {
    productId: string;
    productName: string;
    productPublicId: string;
    asset: { id: string; code: string; publicId: string } | null;
    assets: FundusAsset[];
  } | null;
};

/** Herkunft „Fundus“: Lager-Typ (und optional Exemplar) wählen; wird im Lager-Projekt vorgemerkt. */
export function InventoryLink({ objectId, canEdit, initial }: InventoryLinkProps) {
  const run = useAction();
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<FundusHit[]>([]);
  const [searching, setSearching] = React.useState(false);

  React.useEffect(() => {
    if (initial || !canEdit) return;
    const handle = window.setTimeout(async () => {
      setSearching(true);
      const result = await searchFundusAction({ objectId, query });
      setSearching(false);
      if (result.ok) setHits(result.data ?? []);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query, objectId, initial, canEdit]);

  const [assets, setAssets] = React.useState<FundusAsset[]>(initial?.assets ?? []);

  return (
    <section className="space-y-2 rounded-xl border border-border bg-card px-3 py-3 sm:px-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <WarehouseIcon className="h-4 w-4" /> Aus dem Fundus
      </h3>
      {initial ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Link
              href={`/mitglieder/lager/typ/${initial.productPublicId}`}
              className="min-w-0 flex-1 truncate text-sm font-medium text-primary hover:underline"
            >
              {initial.productName}
            </Link>
            {canEdit ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                aria-label="Verknüpfung lösen"
                onClick={() => void run(() => linkFundusAction({ objectId, productId: null }))}
              >
                <XIcon className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
          {assets.length ? (
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Exemplar</span>
              <select
                className={cn(inputClass, "px-2")}
                value={initial.asset?.id ?? ""}
                disabled={!canEdit}
                onChange={(event) =>
                  void run(() =>
                    linkFundusAction({
                      objectId,
                      productId: initial.productId,
                      assetId: event.target.value || null,
                    }),
                  )
                }
              >
                <option value="">Irgendeins</option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.code}
                    {asset.status !== "available" ? " (nicht verfügbar)" : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Im Lager-Projekt der Produktion vorgemerkt.
          </p>
        </div>
      ) : canEdit ? (
        <div className="space-y-2">
          <label className="relative block">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className={cn(inputClass, "pl-9")}
              value={query}
              placeholder="Im Lager suchen"
              aria-label="Im Lager suchen"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          {hits.length ? (
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {hits.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    onClick={async () => {
                      if (await run(() => linkFundusAction({ objectId, productId: hit.id }))) {
                        const result = await listFundusAssetsAction({
                          objectId,
                          productId: hit.id,
                        });
                        if (result.ok) setAssets(result.data ?? []);
                      }
                    }}
                    className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-border px-2 text-left text-sm hover:bg-muted/40"
                  >
                    {hit.photoId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/lager/photos/${hit.photoId}`}
                        alt=""
                        className="h-8 w-8 rounded object-cover"
                      />
                    ) : null}
                    <span className="min-w-0 flex-1 truncate">{hit.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {hit.area} · {hit.count}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              {searching
                ? "Sucht …"
                : query
                  ? "Nichts gefunden."
                  : "Name, Kategorie oder Tag eingeben."}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Noch kein Lager-Artikel verknüpft.</p>
      )}
    </section>
  );
}
