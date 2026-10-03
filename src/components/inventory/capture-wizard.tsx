"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createAssetAction,
  searchProductsAction,
} from "@/app/(members)/mitglieder/lager/actions/assets";
import { createSetAction } from "@/app/(members)/mitglieder/lager/actions/sets";
import { AssetThumb } from "@/components/inventory/asset-thumb";
import { ConditionSelect, ExemplarFields } from "@/components/inventory/exemplar-fields";
import { PlacementPicker, type PlacementOptions } from "@/components/inventory/placement-picker";
import { ProductFields } from "@/components/inventory/product-fields";
import {
  SetComponentsField,
  type SetComponentDraft,
} from "@/components/inventory/set-components-editor";
import {
  CameraIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  CloseIcon,
  MinusIcon,
  PlusIcon,
  PrinterIcon,
  SearchIcon,
} from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  capturePayload,
  emptyCaptureValues,
  emptyProductValues,
  productPayload,
  type AssetFormArea,
  type CaptureFormValues,
  type ProductFormValues,
} from "@/lib/inventory/asset-form-values";
import {
  INVENTORY_BASE_PATH,
  inventoryAssetPath,
  inventoryProductPath,
  MAX_EXEMPLARS_PER_CAPTURE,
} from "@/lib/inventory/constants";
import type { ProductSearchHit } from "@/lib/inventory/queries";
import { resizeImageFile } from "@/lib/inventory/photo-client";
import type { PlacementTarget } from "@/lib/inventory/service-types";
import { cn } from "@/lib/utils";

type Step = "type" | "details" | "done";

const CARD = "space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5";

/**
 * Erfassen in drei kurzen Schritten (docs/Plan/lager-typen-projekte-plan.md, Phase 4):
 * 1. Was ist es? – vorhandenen Artikeltyp suchen oder neuen anlegen
 * 2. Wie viele, wo? – Anzahl, Ort, Zustand (Merkmale nur bei neuem Typ)
 * 3. Fertig – Etiketten drucken oder gleich weiter
 */
export function CaptureWizard({
  areas,
  placementOptions,
  canManage,
  initialPlacement,
  initialProduct,
  defaultAreaId,
}: {
  areas: AssetFormArea[];
  placementOptions: PlacementOptions;
  canManage: boolean;
  initialPlacement: PlacementTarget;
  initialProduct: ProductSearchHit | null;
  defaultAreaId: string | null;
}) {
  const router = useRouter();
  const defaultArea = areas.find((area) => area.id === defaultAreaId) ?? areas[0];
  const [step, setStep] = React.useState<Step>(initialProduct ? "details" : "type");
  const [product, setProduct] = React.useState<ProductSearchHit | null>(initialProduct);
  const [draft, setDraft] = React.useState<ProductFormValues | null>(null);
  const [capture, setCapture] = React.useState<CaptureFormValues>(() =>
    emptyCaptureValues(initialPlacement),
  );
  const [photo, setPhoto] = React.useState<File | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [result, setResult] = React.useState<{
    codes: string[];
    product: ProductSearchHit | null;
  } | null>(null);
  const [session, setSession] = React.useState<string[]>([]);
  const [components, setComponents] = React.useState<SetComponentDraft[]>([]);

  const kind = product?.kind ?? draft?.kind ?? "unique";
  const inspectionRequired = product?.inspectionRequired ?? draft?.inspectionRequired ?? false;
  const count = Math.max(1, Math.min(MAX_EXEMPLARS_PER_CAPTURE, Number(capture.count) || 1));

  const startNew = (name: string) => {
    setProduct(null);
    setDraft({ ...emptyProductValues(defaultArea), name });
    setStep("details");
  };
  const choose = (hit: ProductSearchHit) => {
    // Sets haben keine eigenen Exemplare – dort gibt es nichts zu erfassen.
    if (hit.kind === "set") {
      router.push(inventoryProductPath(hit.publicId));
      return;
    }
    setProduct(hit);
    setDraft(null);
    setStep("details");
  };
  const restart = () => {
    setProduct(null);
    setDraft(null);
    setPhoto(null);
    setCapture((current) => ({ ...emptyCaptureValues(current.placement) }));
    setStep("type");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!product && !draft) return;
    if (draft && draft.kind === "set") {
      setSaving(true);
      const response = await createSetAction({
        product: productPayload(draft),
        components: components.map((entry) => ({
          productId: entry.productId,
          quantity: entry.quantity,
        })),
      });
      setSaving(false);
      if (!response.ok) {
        toast.error(response.error);
        return;
      }
      toast.success(response.message ?? "Set angelegt.");
      router.push(inventoryProductPath(response.data.publicId));
      return;
    }
    setSaving(true);
    const formData = new FormData();
    const payload = {
      ...(product
        ? {
            ...productPayload(emptyProductValues(defaultArea)),
            areaId: product.areaId,
            kind: product.kind,
            name: product.name,
            productId: product.id,
          }
        : productPayload(draft!)),
      ...capturePayload({ ...capture, count: String(count) }),
    };
    formData.set("asset", JSON.stringify(payload));
    if (photo) formData.set("photo", photo);
    try {
      const response = await createAssetAction(formData);
      if (!response.ok) {
        toast.error(response.error);
        return;
      }
      setResult(response.data);
      setSession((current) => [...current, ...response.data.codes]);
      setStep("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  if (step === "done" && result) {
    return (
      <DoneStep
        result={result}
        session={session}
        onMore={() => {
          if (result.product) {
            setProduct(result.product);
            setDraft(null);
          }
          setPhoto(null);
          setCapture((current) => ({
            ...emptyCaptureValues(current.placement),
            condition: current.condition,
          }));
          setStep("details");
        }}
        onOther={restart}
      />
    );
  }

  if (step === "type") {
    return <TypeStep onChoose={choose} onNew={startNew} />;
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {product ? (
        <section className={cn(CARD, "flex items-center gap-3 space-y-0")}>
          <AssetThumb photoId={product.photoId} kind={product.kind} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-foreground">{product.name}</p>
            <p className="truncate text-sm text-muted-foreground">
              {[product.areaName, product.categoryPath].filter(Boolean).join(" · ")}
              {product.count ? ` · schon ${product.count} im Lager` : ""}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={restart}>
            Ändern
          </Button>
        </section>
      ) : draft ? (
        <section className={CARD}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Neuer Artikeltyp</h2>
              <p className="text-sm text-muted-foreground">Gilt gleich für alle Exemplare.</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={restart}>
              Zurück zur Suche
            </Button>
          </div>
          {draft.kind !== "set" ? <PhotoInput photo={photo} onChange={setPhoto} /> : null}
          <ProductFields values={draft} onChange={setDraft} areas={areas} mode="create" />
        </section>
      ) : null}

      {kind === "set" ? (
        <section className={CARD}>
          <div>
            <h2 className="text-base font-semibold text-foreground">Woraus besteht das Set?</h2>
            <p className="text-sm text-muted-foreground">
              Menge je Set – im Projekt plant man dann z. B. „4 × Funkstrecke“.
            </p>
          </div>
          <SetComponentsField value={components} onChange={setComponents} />
        </section>
      ) : (
        <section className={CARD}>
          <h2 className="text-base font-semibold text-foreground">
            {kind === "bulk" ? "Wie viel und wo?" : "Wie viele und wo?"}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {kind === "bulk" ? (
              <div className="space-y-1.5">
                <Label htmlFor="capture-quantity">
                  Menge ({product?.unit ?? draft?.unit ?? "Stk."})
                </Label>
                <Input
                  id="capture-quantity"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={capture.quantity}
                  onChange={(event) => setCapture({ ...capture, quantity: event.target.value })}
                />
              </div>
            ) : (
              <CountStepper
                value={capture.count}
                onChange={(value) => setCapture({ ...capture, count: value })}
              />
            )}
            <ConditionSelect
              value={capture.condition}
              onChange={(condition) => setCapture({ ...capture, condition })}
            />
            <div className="col-span-2 space-y-1.5">
              <Label>{count > 1 ? "Wo liegen sie?" : "Wo liegt es?"}</Label>
              <PlacementPicker
                value={capture.placement}
                onChange={(placement) => setCapture({ ...capture, placement })}
                options={placementOptions}
              />
              {count > 1 ? (
                <p className="text-xs text-muted-foreground">
                  Alle {count} kommen erst einmal hierhin – umlagern geht später per Scan.
                </p>
              ) : null}
            </div>
          </div>
          {product ? <PhotoInput photo={photo} onChange={setPhoto} compact /> : null}
          <MoreDetails
            values={capture}
            onChange={setCapture}
            single={kind === "bulk" || count === 1}
            inspectionRequired={inspectionRequired}
            canManage={canManage}
          />
        </section>
      )}

      <div className="sticky bottom-[var(--members-bottom-nav,0px)] z-10 -mx-1 flex gap-2 bg-background/95 px-1 py-3 backdrop-blur">
        <Button type="submit" size="lg" disabled={saving} className="flex-1 sm:flex-none">
          <PlusIcon className="mr-2 h-4 w-4" />
          {saving
            ? "Speichert …"
            : kind === "set"
              ? "Set anlegen"
              : kind === "bulk" || count === 1
                ? "Anlegen"
                : `${count} anlegen`}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.push(INVENTORY_BASE_PATH)}
        >
          Abbrechen
        </Button>
      </div>
    </form>
  );
}

function TypeStep({
  onChoose,
  onNew,
}: {
  onChoose: (hit: ProductSearchHit) => void;
  onNew: (name: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<ProductSearchHit[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(
      async () => {
        setLoading(true);
        const response = await searchProductsAction(query);
        if (cancelled) return;
        setLoading(false);
        setHits(response.ok ? response.data : []);
      },
      query ? 200 : 0,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const name = query.trim();
  return (
    <section className={CARD}>
      <div className="space-y-1.5">
        <Label htmlFor="capture-search" className="text-base font-semibold">
          Was möchtest du erfassen?
        </Label>
        <p className="text-sm text-muted-foreground">
          Gibt es den Artikel schon, wähle ihn – dann musst du nur Anzahl und Ort angeben.
        </p>
      </div>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="capture-search"
          autoFocus
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (hits?.length === 1) onChoose(hits[0]!);
              else if (name) onNew(name);
            }
          }}
          placeholder="z. B. Source Four, XLR-Kabel, Gehrock"
          className="pl-9"
        />
      </div>
      <div className="space-y-1">
        {!query && hits?.length ? (
          <p className="text-xs font-medium text-muted-foreground">Zuletzt bearbeitet</p>
        ) : null}
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {(hits ?? []).map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                onClick={() => onChoose(hit)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
              >
                <AssetThumb photoId={hit.photoId} kind={hit.kind} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {hit.name}
                    {hit.model && !hit.name.includes(hit.model) ? (
                      <span className="font-normal text-muted-foreground"> · {hit.model}</span>
                    ) : null}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[hit.areaName, hit.categoryPath].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {hit.kind === "set" ? "Set" : hit.kind === "bulk" ? "Menge" : `${hit.count} Stk.`}
                </span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => onNew(name)}
              className="flex w-full items-center gap-3 px-3 py-3 text-left text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:bg-primary/10 focus-visible:outline-none"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-dashed border-primary/50">
                <PlusIcon className="h-4 w-4" />
              </span>
              {name ? `Neuer Artikeltyp „${name}“` : "Neuen Artikeltyp anlegen"}
            </button>
          </li>
        </ul>
        {loading && !hits ? <p className="text-xs text-muted-foreground">Sucht …</p> : null}
        {query && hits && !hits.length ? (
          <p className="text-xs text-muted-foreground">Nichts Passendes – leg ihn neu an.</p>
        ) : null}
      </div>
    </section>
  );
}

function CountStepper({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const number = Number(value) || 1;
  const set = (next: number) =>
    onChange(String(Math.max(1, Math.min(MAX_EXEMPLARS_PER_CAPTURE, next))));
  return (
    <div className="space-y-1.5">
      <Label htmlFor="capture-count">Anzahl</Label>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => set(number - 1)}
          aria-label="Eins weniger"
          disabled={number <= 1}
        >
          <MinusIcon />
        </Button>
        <Input
          id="capture-count"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_EXEMPLARS_PER_CAPTURE}
          className="w-14 px-1 text-center tabular-nums sm:w-20"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => set(number)}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => set(number + 1)}
          aria-label="Eins mehr"
        >
          <PlusIcon />
        </Button>
      </div>
      <p className="hidden text-xs text-muted-foreground sm:block">
        Jedes Stück bekommt ein eigenes Etikett.
      </p>
    </div>
  );
}

function MoreDetails({
  values,
  onChange,
  single,
  inspectionRequired,
  canManage,
}: {
  values: CaptureFormValues;
  onChange: (values: CaptureFormValues) => void;
  single: boolean;
  inspectionRequired: boolean;
  canManage: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const hint = [
    single ? "Seriennummer" : null,
    inspectionRequired ? "Prüftermin" : null,
    "Notiz",
    canManage ? "Anschaffung" : null,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-left">
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">Weitere Angaben</span>
          <span className="block truncate text-xs text-muted-foreground">{hint}</span>
        </span>
        <ChevronDownIcon
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4">
        <ExemplarFields
          values={values}
          onChange={onChange}
          single={single}
          inspectionRequired={inspectionRequired}
          canManage={canManage}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

function PhotoInput({
  photo,
  onChange,
  compact = false,
}: {
  photo: File | null;
  onChange: (file: File | null) => void;
  compact?: boolean;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => {
      URL.revokeObjectURL(url);
      setPreview(null);
    };
  }, [photo]);

  const pick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      onChange(await resizeImageFile(file));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Foto konnte nicht gelesen werden.");
    }
  };

  return (
    <div className="flex items-center gap-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={pick}
        aria-label="Foto aufnehmen"
      />
      {preview ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element -- lokale Vorschau */}
          <img
            src={preview}
            alt="Vorschau"
            className="h-20 w-20 rounded-lg border border-border object-cover"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:text-foreground"
            aria-label="Foto entfernen"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size={compact ? "sm" : "md"}
          onClick={() => fileRef.current?.click()}
        >
          <CameraIcon className="mr-2 h-4 w-4" />
          Foto {compact ? "für den Artikel ergänzen" : "aufnehmen"}
        </Button>
      )}
      <span className="text-xs text-muted-foreground">
        {preview ? "Gilt für alle Exemplare." : "Optional – zeigt sich bei allen Exemplaren."}
      </span>
    </div>
  );
}

function DoneStep({
  result,
  session,
  onMore,
  onOther,
}: {
  result: { codes: string[]; product: ProductSearchHit | null };
  session: string[];
  onMore: () => void;
  onOther: () => void;
}) {
  const { codes, product } = result;
  const first = codes[0]!;
  const range = codes.length > 1 ? `${first} … ${codes[codes.length - 1]}` : first;
  return (
    <div className="space-y-5">
      <section className={cn(CARD, "border-success/40 bg-success/5")}>
        <p className="flex items-center gap-2 text-base font-semibold text-foreground">
          <CheckCircleIcon className="h-5 w-5 text-success" />
          {codes.length === 1 ? "Angelegt" : `${codes.length} Exemplare angelegt`}
        </p>
        <p className="text-sm text-muted-foreground">
          {product?.name} · <span className="font-mono">{range}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link
              href={`${INVENTORY_BASE_PATH}/etiketten?codes=${encodeURIComponent(codes.join(","))}`}
            >
              <PrinterIcon className="mr-2 h-4 w-4" />
              {codes.length === 1 ? "Etikett drucken" : `${codes.length} Etiketten drucken`}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link
              href={
                product && (product.count > 1 || codes.length > 1)
                  ? inventoryProductPath(product.publicId)
                  : inventoryAssetPath(first)
              }
            >
              Ansehen
            </Link>
          </Button>
        </div>
      </section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {product && product.kind !== "bulk" ? (
          <Button variant="outline" size="lg" onClick={onMore}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Weitere „{product.name}“
          </Button>
        ) : null}
        <Button variant="outline" size="lg" onClick={onOther}>
          <SearchIcon className="mr-2 h-4 w-4" />
          Anderen Artikel erfassen
        </Button>
      </div>
      {session.length > codes.length ? (
        <p className="text-sm text-muted-foreground">
          In dieser Runde: {session.length} Exemplare ·{" "}
          <Link
            href={`${INVENTORY_BASE_PATH}/etiketten?codes=${encodeURIComponent(session.join(","))}`}
            className="font-medium text-primary hover:underline"
          >
            alle Etiketten drucken
          </Link>
        </p>
      ) : null}
    </div>
  );
}
