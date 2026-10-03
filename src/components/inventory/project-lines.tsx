"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { searchProductsAction } from "@/app/(members)/mitglieder/lager/actions/assets";
import {
  addProjectLineAction,
  removeProjectLineAction,
  updateProjectLineAction,
} from "@/app/(members)/mitglieder/lager/actions/projects";
import { AssetThumb } from "@/components/inventory/asset-thumb";
import { ToneBadge } from "@/components/inventory/tone-badge";
import { PlusIcon, SearchIcon, TrashIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inventoryProductPath, type AssetKind } from "@/lib/inventory/constants";
import { inventoryProjectPath, PROJECT_STATUS_LABELS } from "@/lib/inventory/project-constants";
import type { Availability, LineVerdict } from "@/lib/inventory/projects";
import type { ProductSearchHit } from "@/lib/inventory/queries";

export type ProjectLineView = {
  id: string;
  quantity: number;
  product: {
    id: string;
    publicId: string;
    name: string;
    kind: AssetKind;
    unit: string | null;
    categoryPath: string | null;
    photoId: string | null;
    area: { name: string };
  };
  availability: Availability | null;
  verdict: LineVerdict;
};

const VERDICT = {
  ok: { tone: "success", label: "frei" },
  tight: { tone: "warning", label: "knapp" },
  short: { tone: "destructive", label: "fehlt" },
} as const;

/**
 * Material eines Projekts auf Typ-Ebene („12 × Source Four“) mit Verfügbarkeit im
 * Projektzeitraum. Überbuchen ist erlaubt – die Ampel warnt nur.
 */
export function ProjectLines({
  projectId,
  lines,
  hasWindow,
}: {
  projectId: string;
  lines: ProjectLineView[];
  hasWindow: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);

  const run = async (promise: Promise<{ ok: boolean; error?: string }>) => {
    const result = await promise;
    if (!result.ok) toast.error(result.error ?? "Fehler");
    router.refresh();
    return result.ok;
  };

  const short = lines.filter((line) => line.verdict === "short").length;

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Material</h2>
          <p className="text-sm text-muted-foreground">
            {hasWindow
              ? short
                ? `${short} ${short === 1 ? "Artikel reicht" : "Artikel reichen"} im Zeitraum nicht.`
                : "Verfügbarkeit im Projektzeitraum, andere Projekte eingerechnet."
              : "Ohne Termine lässt sich die Verfügbarkeit nicht prüfen."}
          </p>
        </div>
        {!adding ? (
          <Button size="sm" onClick={() => setAdding(true)}>
            <PlusIcon className="mr-1.5 h-4 w-4" />
            Material
          </Button>
        ) : null}
      </div>

      {adding ? (
        <AddLine
          onAdd={async (hit, quantity) => {
            if (await run(addProjectLineAction(projectId, { productId: hit.id, quantity }))) {
              toast.success(`${quantity} × ${hit.name} eingeplant.`);
            }
          }}
          onClose={() => setAdding(false)}
        />
      ) : null}

      {lines.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {lines.map((line) => (
            <LineRow key={line.id} line={line} hasWindow={hasWindow} run={run} />
          ))}
        </ul>
      ) : !adding ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Noch kein Material eingeplant.
        </p>
      ) : null}
    </section>
  );
}

function LineRow({
  line,
  hasWindow,
  run,
}: {
  line: ProjectLineView;
  hasWindow: boolean;
  run: (promise: Promise<{ ok: boolean; error?: string }>) => Promise<boolean>;
}) {
  const [quantity, setQuantity] = React.useState(String(line.quantity));
  React.useEffect(() => setQuantity(String(line.quantity)), [line.quantity]);
  const availability = line.availability;
  const unit = line.product.kind === "bulk" ? (line.product.unit ?? "Stk.") : "Stk.";
  const free = availability ? availability.capacity - availability.confirmed : 0;
  const commit = () => {
    const next = Number(quantity);
    if (!Number.isInteger(next) || next < 1) {
      setQuantity(String(line.quantity));
      return;
    }
    if (next !== line.quantity) void run(updateProjectLineAction(line.id, { quantity: next }));
  };

  return (
    <li className="flex flex-wrap items-center gap-3 px-3 py-2.5 sm:flex-nowrap">
      <AssetThumb photoId={line.product.photoId} kind={line.product.kind} size="sm" />
      <div className="min-w-0 flex-1">
        <Link
          href={inventoryProductPath(line.product.publicId)}
          className="block truncate text-sm font-medium text-foreground hover:underline"
        >
          {line.product.name}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {availability
            ? `${free} von ${availability.capacity} ${unit} frei`
            : (line.product.categoryPath ?? line.product.area.name)}
          {availability && availability.total > availability.capacity
            ? ` · ${availability.total - availability.capacity} defekt/fehlt`
            : ""}
        </p>
        {availability?.reservations.length ? (
          <p className="truncate text-xs text-muted-foreground">
            Auch in:{" "}
            {availability.reservations.map((entry, index) => (
              <span key={entry.projectId}>
                {index ? ", " : ""}
                <Link href={inventoryProjectPath(entry.publicId)} className="hover:underline">
                  {entry.title}
                </Link>{" "}
                ({entry.quantity}
                {entry.status === "request"
                  ? `, ${PROJECT_STATUS_LABELS.request.toLowerCase()}`
                  : ""}
                )
              </span>
            ))}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {hasWindow ? (
          <ToneBadge tone={VERDICT[line.verdict].tone}>{VERDICT[line.verdict].label}</ToneBadge>
        ) : null}
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
          }}
          className="h-9 w-20 text-right tabular-nums"
          aria-label={`Menge ${line.product.name}`}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-destructive"
          aria-label={`${line.product.name} entfernen`}
          onClick={() => run(removeProjectLineAction(line.id))}
        >
          <TrashIcon className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}

function AddLine({
  onAdd,
  onClose,
}: {
  onAdd: (hit: ProductSearchHit, quantity: number) => Promise<void>;
  onClose: () => void;
}) {
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<ProductSearchHit[]>([]);
  const [quantity, setQuantity] = React.useState("1");

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

  const amount = Math.max(1, Number(quantity) || 1);
  return (
    <div className="space-y-2 rounded-lg border border-primary/40 p-3">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Artikel suchen, z. B. Source Four"
            className="pl-9"
            aria-label="Artikel suchen"
          />
        </div>
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          className="w-20 text-right tabular-nums"
          aria-label="Menge"
        />
        <Button variant="ghost" onClick={onClose}>
          Fertig
        </Button>
      </div>
      <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-md border border-border">
        {hits.map((hit) => (
          <li key={hit.id}>
            <button
              type="button"
              onClick={() => onAdd(hit, amount)}
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
              <span className="shrink-0 text-xs font-medium text-primary">+ {amount}</span>
            </button>
          </li>
        ))}
        {!hits.length ? (
          <li className="px-3 py-2 text-sm text-muted-foreground">Kein Artikel gefunden.</li>
        ) : null}
      </ul>
    </div>
  );
}
