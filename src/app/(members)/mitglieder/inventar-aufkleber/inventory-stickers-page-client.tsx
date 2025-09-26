"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CirclePlus,
  Minus,
  Plus,
  Printer,
  Search,
  Trash2,
} from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";

import { PageHeader } from "@/components/members/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/typography";
import type { MembersBreadcrumbItem } from "@/lib/members-breadcrumbs";
import { cn } from "@/lib/utils";

type InventoryItemOption = {
  id: string;
  sku: string;
  name: string;
  location: string | null;
  owner: string | null;
};

type StickerSource = "inventory" | "sequence" | "manual";

type StickerEntry = {
  key: string;
  code: string;
  primaryText: string;
  secondaryText?: string;
  copies: number;
  source: StickerSource;
  sourceId?: string;
};

type StickerPreviewEntry = {
  key: string;
  code: string;
  primaryText: string;
  secondaryText?: string;
};

interface InventoryStickersPageClientProps {
  inventoryItems: InventoryItemOption[];
  breadcrumb: MembersBreadcrumbItem;
  hasDatabase: boolean;
}

type TemplateContext = {
  code: string;
  number: string;
  rawNumber: string;
  counter: string;
};

const qrCodeCache = new Map<string, string>();

function createStickerKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `sticker-${Math.random().toString(36).slice(2)}`;
}

function createStickerEntry(entry: Omit<StickerEntry, "key">): StickerEntry {
  return { ...entry, key: createStickerKey() };
}

function normalizeDetails(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function applyTemplate(template: string, context: TemplateContext) {
  return template.replace(/{{\s*(code|number|rawNumber|counter)\s*}}/g, (_, key: keyof TemplateContext) => {
    return context[key] ?? "";
  });
}

function useQrCodeData(code: string) {
  const [dataUrl, setDataUrl] = useState<string | null>(() => qrCodeCache.get(code) ?? null);

  useEffect(() => {
    let isMounted = true;

    const cached = qrCodeCache.get(code);
    if (cached) {
      setDataUrl(cached);
      return () => {
        isMounted = false;
      };
    }

    QRCode.toDataURL(code, { margin: 1, width: 256 })
      .then((url) => {
        qrCodeCache.set(code, url);
        if (isMounted) {
          setDataUrl(url);
        }
      })
      .catch((error) => {
        console.error(`[inventory-stickers] Failed to render QR code for ${code}`, error);
        if (isMounted) {
          setDataUrl(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [code]);

  return dataUrl;
}

function StickerPreviewCard({
  entry,
}: {
  entry: StickerPreviewEntry;
}) {
  const dataUrl = useQrCodeData(entry.code);

  return (
    <div className="relative aspect-[3/2] break-inside-avoid-page">
      <div
        className="absolute inset-0 flex flex-col justify-between rounded-xl border border-border/70 bg-background/95 p-3 text-foreground shadow-sm print:border-black/30 print:bg-white print:text-black print:shadow-none"
      >
        <div className="flex flex-1 items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <Text
              variant="eyebrow"
              tone="muted"
              className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground/80 print:text-black/60"
            >
              Inventar
            </Text>
            <Text className="text-lg font-semibold leading-tight text-balance">
              {entry.primaryText}
            </Text>
            {entry.secondaryText ? (
              <Text variant="caption" tone="muted" className="text-balance print:text-black/70">
                {entry.secondaryText}
              </Text>
            ) : null}
          </div>
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/70 bg-white p-1 print:border-black/40">
            {dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={dataUrl}
                alt={`QR-Code für ${entry.code}`}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground print:text-black/60">
                QR
              </div>
            )}
          </div>
        </div>
        <div className="mt-2 border-t border-dashed border-border/70 pt-1.5 print:border-black/40">
          <Text className="font-mono text-sm tracking-[0.18em] text-foreground/90 print:text-black">
            {entry.code}
          </Text>
        </div>
      </div>
    </div>
  );
}

const sequenceFormSchema = z.object({
  prefix: z
    .string()
    .min(1, "Prefix angeben")
    .max(64, "Prefix ist zu lang"),
  start: z.coerce.number().int().min(0, "Startwert darf nicht negativ sein").max(1_000_000, "Startwert ist zu groß"),
  count: z.coerce
    .number()
    .int()
    .min(1, "Mindestens ein Aufkleber")
    .max(200, "Maximal 200 Aufkleber pro Durchgang"),
  digits: z.coerce
    .number()
    .int()
    .min(0, "Ziffern dürfen nicht negativ sein")
    .max(8, "Maximal 8 führende Nullen"),
  titleTemplate: z
    .string()
    .min(1, "Titel angeben")
    .max(80, "Titel ist zu lang"),
  subtitleTemplate: z.string().max(80, "Zusatzzeile ist zu lang").optional(),
});

type SequenceFormValues = z.infer<typeof sequenceFormSchema>;

const manualFormSchema = z.object({
  code: z.string().min(1, "Code angeben").max(120, "Code ist zu lang"),
  title: z
    .string()
    .min(1, "Titel angeben")
    .max(100, "Titel ist zu lang"),
  subtitle: z.string().max(120, "Zusatzzeile ist zu lang").optional(),
  copies: z.coerce
    .number()
    .int()
    .min(1, "Mindestens ein Exemplar")
    .max(100, "Maximal 100 Exemplare"),
});

type ManualFormValues = z.infer<typeof manualFormSchema>;

const MAX_TOTAL_STICKERS = 400;

export default function InventoryStickersPageClient({
  inventoryItems,
  breadcrumb,
  hasDatabase,
}: InventoryStickersPageClientProps) {
  const [stickers, setStickers] = useState<StickerEntry[]>([]);
  const [inventoryQuery, setInventoryQuery] = useState("");

  const sequenceForm = useForm<SequenceFormValues>({
    resolver: zodResolver(sequenceFormSchema) as Resolver<SequenceFormValues>,
    defaultValues: {
      prefix: "inventory-",
      start: 1,
      count: 24,
      digits: 3,
      titleTemplate: "{{code}}",
      subtitleTemplate: "Inventar",
    },
  });

  const manualForm = useForm<ManualFormValues>({
    resolver: zodResolver(manualFormSchema) as Resolver<ManualFormValues>,
    defaultValues: {
      code: "",
      title: "",
      subtitle: "",
      copies: 1,
    },
  });

  const totalStickers = useMemo(
    () =>
      stickers.reduce((sum, entry) => {
        return sum + Math.max(0, entry.copies);
      }, 0),
    [stickers],
  );

  const previewEntries = useMemo(() => {
    const entries: StickerPreviewEntry[] = [];

    for (const entry of stickers) {
      const copies = Math.max(0, entry.copies);
      for (let index = 0; index < copies; index += 1) {
        entries.push({
          key: `${entry.key}-${index}`,
          code: entry.code,
          primaryText: entry.primaryText,
          secondaryText: entry.secondaryText,
        });
      }
    }

    return entries;
  }, [stickers]);

  const filteredInventory = useMemo(() => {
    const normalized = inventoryQuery.trim().toLowerCase();
    if (!normalized) {
      return inventoryItems.slice(0, 10);
    }

    return inventoryItems
      .filter((item) => {
        const skuMatch = item.sku.toLowerCase().includes(normalized);
        const idMatch = item.id.toLowerCase().includes(normalized);
        const nameMatch = item.name.toLowerCase().includes(normalized);
        const locationMatch = item.location?.toLowerCase().includes(normalized) ?? false;
        return skuMatch || idMatch || nameMatch || locationMatch;
      })
      .slice(0, 12);
  }, [inventoryItems, inventoryQuery]);

  const addInventoryItem = useCallback(
    (item: InventoryItemOption) => {
      const details = [normalizeDetails(item.location), normalizeDetails(item.owner ? `Verantwortlich: ${item.owner}` : null)]
        .filter(Boolean)
        .join(" • ");

      setStickers((previous) => {
        const existingIndex = previous.findIndex((entry) => entry.code === item.sku);
        if (existingIndex >= 0) {
          const next = [...previous];
          const current = next[existingIndex];
          next[existingIndex] = {
            ...current,
            primaryText: item.name,
            secondaryText: details.length > 0 ? details : undefined,
            copies: Math.min(current.copies + 1, MAX_TOTAL_STICKERS),
          };
          return next;
        }

        return [
          ...previous,
          createStickerEntry({
            code: item.sku,
            primaryText: item.name,
            secondaryText: details.length > 0 ? details : undefined,
            copies: 1,
            source: "inventory",
            sourceId: item.id,
          }),
        ];
      });

      toast.success(`"${item.name}" zur Druckliste hinzugefügt.`);
    },
    [],
  );

  const handleInventorySearchKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        const [first] = filteredInventory;
        if (first) {
          addInventoryItem(first);
        }
      }

      if (event.key === "Escape" && inventoryQuery) {
        setInventoryQuery("");
      }
    },
    [addInventoryItem, filteredInventory, inventoryQuery],
  );

  const handleGenerateSequence = sequenceForm.handleSubmit((values) => {
    const prefix = values.prefix.trim();
    const titleTemplate = values.titleTemplate.trim() || "{{code}}";
    const subtitleTemplate = values.subtitleTemplate?.trim();
    const created: StickerEntry[] = [];

    for (let index = 0; index < values.count; index += 1) {
      const rawNumber = values.start + index;
      const numberPart = values.digits > 0 ? rawNumber.toString().padStart(values.digits, "0") : String(rawNumber);
      const code = `${prefix}${numberPart}`;
      const context: TemplateContext = {
        code,
        number: numberPart,
        rawNumber: String(rawNumber),
        counter: String(index + 1),
      };
      const secondary = subtitleTemplate?.length ? applyTemplate(subtitleTemplate, context) : undefined;

      created.push(
        createStickerEntry({
          code,
          primaryText: applyTemplate(titleTemplate, context),
          secondaryText: secondary,
          copies: 1,
          source: "sequence",
        }),
      );
    }

    if (!created.length) {
      toast.error("Keine Aufkleber generiert.");
      return;
    }

    setStickers((previous) => [...previous, ...created]);
    toast.success(`${created.length} Inventaraufkleber hinzugefügt.`);
  });

  const handleAddManualSticker = manualForm.handleSubmit((values) => {
    const code = values.code.trim();
    const title = values.title.trim();
    const subtitle = values.subtitle?.trim();

    const copies = Math.min(values.copies, MAX_TOTAL_STICKERS);

    setStickers((previous) => [
      ...previous,
      createStickerEntry({
        code,
        primaryText: title,
        secondaryText: subtitle ? subtitle : undefined,
        copies,
        source: "manual",
      }),
    ]);

    toast.success(`Aufkleber ${code} hinzugefügt.`);
    manualForm.reset({ code: "", title: "", subtitle: values.subtitle ?? "", copies: 1 });
  });

  const adjustCopies = useCallback((key: string, delta: number) => {
    setStickers((previous) =>
      previous.map((entry) => {
        if (entry.key !== key) {
          return entry;
        }

        const nextCopies = Math.max(1, Math.min(MAX_TOTAL_STICKERS, entry.copies + delta));
        return { ...entry, copies: nextCopies };
      }),
    );
  }, []);

  const updateSticker = useCallback((key: string, patch: Partial<Omit<StickerEntry, "key" | "copies" | "source" | "sourceId">>) => {
    setStickers((previous) =>
      previous.map((entry) => {
        if (entry.key !== key) {
          return entry;
        }

        return { ...entry, ...patch };
      }),
    );
  }, []);

  const removeSticker = useCallback((key: string) => {
    setStickers((previous) => previous.filter((entry) => entry.key !== key));
  }, []);

  const clearStickers = useCallback(() => {
    setStickers([]);
    toast.info("Druckliste geleert.");
  }, []);

  const handlePrint = useCallback(() => {
    if (typeof window !== "undefined") {
      window.print();
    }
  }, []);

  return (
    <div className="space-y-6 pb-16">
      <div className="print:hidden">
        <PageHeader
          title="Inventaraufkleber"
          description="Erstelle druckfertige Inventaraufkleber mit QR-Codes für bestehende oder neue Gegenstände."
          breadcrumbs={[breadcrumb]}
          actions={
            <Button type="button" onClick={handlePrint} disabled={previewEntries.length === 0}>
              <Printer className="mr-2 h-4 w-4" /> Druckansicht
            </Button>
          }
          status={
            totalStickers > 0 ? (
              <Badge variant="outline">{totalStickers} Sticker bereit</Badge>
            ) : (
              <Badge variant="ghost">Noch keine Sticker</Badge>
            )
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="space-y-6 print:hidden">
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle>Inventar auswählen</CardTitle>
              <Text variant="small" tone="muted">
                Suche nach vorhandenen Gegenständen und füge sie mit einem Klick zur Druckliste hinzu.
              </Text>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasDatabase ? (
                <>
                  <div>
                    <label
                      htmlFor="inventory-search"
                      className="block text-sm font-medium text-muted-foreground"
                    >
                      Inventar durchsuchen
                    </label>
                    <div className="relative mt-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="inventory-search"
                        type="search"
                        value={inventoryQuery}
                        onChange={(event) => setInventoryQuery(event.target.value)}
                        onKeyDown={handleInventorySearchKeyDown}
                        placeholder="Name, ID oder Standort"
                        className="pl-9"
                        autoComplete="off"
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Enter fügt das erste Ergebnis hinzu, Escape leert die Suche.
                    </p>
                  </div>
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {filteredInventory.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
                        Keine passenden Inventar-Einträge gefunden.
                      </div>
                    ) : (
                      filteredInventory.map((item) => {
                        const subtitleParts = [
                          normalizeDetails(item.location),
                          normalizeDetails(item.owner ? `Verantwortlich: ${item.owner}` : null),
                        ].filter(Boolean);

                        return (
                          <div
                            key={item.sku}
                            className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/80 p-3 shadow-sm"
                          >
                            <div className="min-w-0 space-y-1">
                              <Text variant="small" weight="semibold" className="truncate">
                                {item.name}
                              </Text>
                              <Text
                                variant="caption"
                                tone="muted"
                                className="flex items-center gap-2 text-xs"
                              >
                                <span className="font-mono">{item.sku}</span>
                                {subtitleParts.length > 0 ? (
                                  <span className="truncate">{subtitleParts.join(" • ")}</span>
                                ) : null}
                              </Text>
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={() => addInventoryItem(item)}>
                              <CirclePlus className="mr-2 h-4 w-4" /> Hinzufügen
                            </Button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-6 text-sm text-muted-foreground">
                  <Text>
                    Die Datenbank ist nicht verbunden. Nutze den Generator oder füge Sticker manuell hinzu.
                  </Text>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle>Sequenz generieren</CardTitle>
              <Text variant="small" tone="muted">
                Erzeuge fortlaufende Inventar-Codes mit eigenen Beschriftungen. Platzhalter wie
                {" "}
                <code className="rounded bg-muted/40 px-1 py-0.5 text-xs">{`{{code}}`}</code> oder
                {" "}
                <code className="rounded bg-muted/40 px-1 py-0.5 text-xs">{`{{number}}`}</code>
                werden automatisch ersetzt.
              </Text>
            </CardHeader>
            <CardContent>
              <Form {...sequenceForm}>
                <form onSubmit={handleGenerateSequence} className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField
                      control={sequenceForm.control}
                      name="prefix"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prefix</FormLabel>
                          <FormControl>
                            <Input {...field} autoComplete="off" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={sequenceForm.control}
                      name="start"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Startwert</FormLabel>
                          <FormControl>
                            <Input type="number" inputMode="numeric" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField
                      control={sequenceForm.control}
                      name="count"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Anzahl</FormLabel>
                          <FormControl>
                            <Input type="number" inputMode="numeric" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={sequenceForm.control}
                      name="digits"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Führende Nullen</FormLabel>
                          <FormControl>
                            <Input type="number" inputMode="numeric" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={sequenceForm.control}
                    name="titleTemplate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Titelzeile</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormDescription>
                          Verwendet Platzhalter wie {`{{code}}`} oder {`{{counter}}`}.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={sequenceForm.control}
                    name="subtitleTemplate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Zusatzzeile (optional)</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormDescription>Leer lassen, wenn keine zweite Zeile benötigt wird.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <Text variant="caption" tone="muted">
                      Shift + Klick auf die Anzahl-Buttons im Stickerbereich erzeugt bzw. entfernt fünf Kopien.
                    </Text>
                    <Button type="submit">Sticker hinzufügen</Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle>Einzelnen Sticker anlegen</CardTitle>
              <Text variant="small" tone="muted">
                Füge individuelle Codes hinzu, zum Beispiel für Sonderfälle ohne vorhandenen Inventar-Eintrag.
              </Text>
            </CardHeader>
            <CardContent>
              <Form {...manualForm}>
                <form onSubmit={handleAddManualSticker} className="space-y-4">
                  <FormField
                    control={manualForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Code</FormLabel>
                        <FormControl>
                          <Input {...field} autoComplete="off" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={manualForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Titelzeile</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={manualForm.control}
                    name="subtitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Zusatzzeile (optional)</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <FormField
                      control={manualForm.control}
                      name="copies"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Anzahl</FormLabel>
                          <FormControl>
                            <Input type="number" inputMode="numeric" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="self-end">
                      <CirclePlus className="mr-2 h-4 w-4" /> Hinzufügen
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="print:hidden">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Stickerliste</CardTitle>
                <Text variant="small" tone="muted">
                  Passe Codes, Beschriftungen und die Anzahl der Aufkleber an.
                </Text>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearStickers}
                disabled={stickers.length === 0}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Liste leeren
              </Button>
            </CardHeader>
            <CardContent>
              {stickers.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
                  Noch keine Sticker in der Liste. Füge Inventar hinzu oder nutze den Generator.
                </div>
              ) : (
                <div className="space-y-4">
                  {stickers.map((entry) => (
                    <div
                      key={entry.key}
                      className="space-y-3 rounded-lg border border-border/60 bg-background/80 p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge
                          variant={
                            entry.source === "inventory"
                              ? "secondary"
                              : entry.source === "sequence"
                                ? "info"
                                : "muted"
                          }
                          size="sm"
                        >
                          {entry.source === "inventory"
                            ? "Bestand"
                            : entry.source === "sequence"
                              ? "Generator"
                              : "Manuell"}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={(event) => adjustCopies(entry.key, event.shiftKey ? -5 : -1)}
                            disabled={entry.copies <= 1}
                            title="Minus 1 (Shift: -5)"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Text className="w-12 text-center font-mono text-sm" aria-live="polite">
                            {entry.copies}
                          </Text>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={(event) => adjustCopies(entry.key, event.shiftKey ? 5 : 1)}
                            disabled={entry.copies >= MAX_TOTAL_STICKERS}
                            title="Plus 1 (Shift: +5)"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSticker(entry.key)}
                            title="Sticker entfernen"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-muted-foreground">Code</label>
                        <Input
                          value={entry.code}
                          onChange={(event) => updateSticker(entry.key, { code: event.target.value })}
                          className="font-mono"
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-muted-foreground">Titelzeile</label>
                          <Input
                            value={entry.primaryText}
                            onChange={(event) => updateSticker(entry.key, { primaryText: event.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-muted-foreground">Zusatzzeile</label>
                          <Input
                            value={entry.secondaryText ?? ""}
                            onChange={(event) =>
                              updateSticker(entry.key, {
                                secondaryText: event.target.value.length > 0 ? event.target.value : undefined,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <section className="space-y-4" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div>
                <Text variant="small" weight="semibold">
                  Vorschau
                </Text>
                <Text variant="caption" tone="muted">
                  Gesamt: {totalStickers} Sticker
                </Text>
              </div>
              <Text variant="caption" tone="muted">
                Druck-Tipp: Lege in den Browser-Druckeinstellungen kleine Ränder fest und deaktiviere Kopf- und Fußzeilen.
              </Text>
            </div>
            {previewEntries.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/70 p-12 text-center text-sm text-muted-foreground">
                Keine Sticker zum Anzeigen. Füge Einträge hinzu, um die Vorschau zu sehen.
              </div>
            ) : (
              <div
                className={cn(
                  "grid gap-4 print:gap-6",
                  previewEntries.length >= 6
                    ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
                    : "grid-cols-1 sm:grid-cols-2",
                )}
              >
                {previewEntries.map((entry) => (
                  <StickerPreviewCard key={entry.key} entry={entry} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
