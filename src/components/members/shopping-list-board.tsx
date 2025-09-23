"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Share2, Undo2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ShoppingListEntry } from "@/lib/meal-planning/shopping-list";
import { cn } from "@/lib/utils";

const SharedItemSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  amount: z.number().optional(),
  amountText: z.string().optional(),
  unit: z.string().optional(),
  category: z.string().optional(),
  checked: z.boolean().optional(),
  source: z.enum(["plan", "custom"]).optional(),
});

type SharedItem = z.infer<typeof SharedItemSchema>;

type ShoppingListBoardProps = {
  initialItems: ShoppingListEntry[];
};

type ShoppingListItemState = {
  id: string;
  name: string;
  amount: number | null;
  amountText: string | null;
  unit: string;
  category: string;
  checked: boolean;
  source: "plan" | "custom";
};

type CategoryBucket = {
  name: string;
  items: ShoppingListItemState[];
};

type NewItemDraft = {
  name: string;
  amount: string;
  unit: string;
  category: string;
};

function encodeItemsForShare(items: ShoppingListItemState[]): string {
  const payload: SharedItem[] = items.map((item) => ({
    id: item.source === "plan" ? undefined : item.id,
    name: item.name,
    amount: item.amount ?? undefined,
    amountText: item.amountText ?? undefined,
    unit: item.unit || undefined,
    category: item.category || undefined,
    checked: item.checked || undefined,
    source: item.source === "custom" ? item.source : undefined,
  }));
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  let binary = "";
  data.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return typeof window !== "undefined" ? window.btoa(binary) : "";
}

function decodeSharedItems(encoded: string): SharedItem[] | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const binary = window.atob(encoded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const decoder = new TextDecoder();
    const json = decoder.decode(bytes);
    const data = JSON.parse(json);
    return z.array(SharedItemSchema).parse(data);
  } catch (error) {
    console.error("Failed to decode shared shopping list", error);
    return null;
  }
}

function formatCategory(value: string | null | undefined) {
  if (!value) return "Sonstiges";
  const trimmed = value.trim();
  if (!trimmed) return "Sonstiges";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function createStateFromEntries(entries: ShoppingListEntry[]): ShoppingListItemState[] {
  return entries.map((entry) => ({
    id: entry.id,
    name: entry.name,
    amount: entry.amount,
    amountText: null,
    unit: entry.unit,
    category: formatCategory(entry.category),
    checked: false,
    source: "plan",
  }));
}

function mapSharedItemsToState(shared: SharedItem[]): ShoppingListItemState[] {
  return shared.map((item, index) => ({
    id: item.id ?? `shared-${index}`,
    name: item.name,
    amount: typeof item.amount === "number" ? item.amount : null,
    amountText: item.amountText ?? null,
    unit: item.unit ?? "",
    category: formatCategory(item.category),
    checked: item.checked ?? false,
    source: item.source === "custom" ? "custom" : "plan",
  }));
}

function groupByCategory(items: ShoppingListItemState[]): CategoryBucket[] {
  const buckets = new Map<string, ShoppingListItemState[]>();
  for (const item of items) {
    const key = formatCategory(item.category);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      buckets.set(key, [item]);
    }
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "de-DE"))
    .map(([name, bucketItems]) => ({
      name,
      items: bucketItems.sort((a, b) => a.name.localeCompare(b.name, "de-DE")),
    }));
}

export function ShoppingListBoard({ initialItems }: ShoppingListBoardProps) {
  const searchParams = useSearchParams();
  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat("de-DE", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
      }),
    [],
  );
  const baseItems = useMemo(() => createStateFromEntries(initialItems), [initialItems]);
  const [items, setItems] = useState<ShoppingListItemState[]>(baseItems);
  const [sharedFromUrl, setSharedFromUrl] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newItem, setNewItem] = useState<NewItemDraft>({
    name: "",
    amount: "",
    unit: "",
    category: "",
  });

  useEffect(() => {
    if (!searchParams) {
      setItems(baseItems);
      setSharedFromUrl(false);
      return;
    }
    const encoded = searchParams.get("list");
    if (!encoded) {
      setItems(baseItems);
      setSharedFromUrl(false);
      return;
    }
    const decoded = decodeSharedItems(encoded);
    if (!decoded) {
      toast.error("Geteilte Einkaufsliste konnte nicht geladen werden.");
      setItems(baseItems);
      setSharedFromUrl(false);
      return;
    }
    setItems(mapSharedItemsToState(decoded));
    setSharedFromUrl(true);
  }, [searchParams, baseItems]);

  const categoryBuckets = useMemo(() => groupByCategory(items), [items]);
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const item of baseItems) {
      if (item.category) {
        set.add(item.category);
      }
    }
    for (const item of items) {
      if (item.category) {
        set.add(item.category);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "de-DE"));
  }, [baseItems, items]);

  const handleToggle = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              checked: !item.checked,
            }
          : item,
      ),
    );
  };

  const handleAddItem = () => {
    const trimmedName = newItem.name.trim();
    if (!trimmedName) {
      toast.error("Bitte gib einen Namen für den Artikel an.");
      return;
    }
    const normalizedCategory = formatCategory(newItem.category);
    const parsedAmount = newItem.amount.trim();
    const amountValue = parsedAmount.length ? Number.parseFloat(parsedAmount.replace(",", ".")) : NaN;
    const nextItem: ShoppingListItemState = {
      id: crypto.randomUUID(),
      name: trimmedName,
      amount: Number.isFinite(amountValue) ? amountValue : null,
      amountText: Number.isFinite(amountValue) ? null : parsedAmount || null,
      unit: newItem.unit.trim(),
      category: normalizedCategory,
      checked: false,
      source: "custom",
    };
    setItems((prev) => [...prev, nextItem]);
    setIsDialogOpen(false);
    setNewItem({ name: "", amount: "", unit: "", category: normalizedCategory === "Sonstiges" ? "" : normalizedCategory });
  };

  const handleReset = () => {
    setItems(baseItems);
    setSharedFromUrl(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("list");
      window.history.replaceState(null, "", url.toString());
    }
  };

  const handleShare = async () => {
    if (typeof window === "undefined") {
      return;
    }
    const encoded = encodeItemsForShare(items);
    const url = new URL(window.location.href);
    url.searchParams.set("list", encoded);
    try {
      await navigator.clipboard.writeText(url.toString());
      toast.success("Teilbaren Link in die Zwischenablage kopiert.");
      window.history.replaceState(null, "", url.toString());
      setSharedFromUrl(true);
    } catch (error) {
      console.error("Failed to copy shopping list share link", error);
      toast.error("Link konnte nicht kopiert werden. Bitte versuche es erneut.");
    }
  };

  return (
    <Card className="border border-border/60 bg-background/80">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl font-semibold">Einkaufsliste</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ergänze individuelle Positionen, hake erledigte Besorgungen ab und teile die Liste bequem mit Helferinnen und Helfern.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {sharedFromUrl ? (
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                Geteilte Liste
              </Badge>
            ) : null}
            <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
              <Undo2 className="h-4 w-4" /> Standardliste
            </Button>
            <Button variant="outline" size="sm" onClick={handleShare} className="gap-2">
              <Share2 className="h-4 w-4" /> Link teilen
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" /> Position hinzufügen
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Neue Position zur Einkaufsliste</DialogTitle>
                  <DialogDescription>Ergänze zusätzliche Artikel für individuelle Besorgungen.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="shopping-item-name">Bezeichnung *</Label>
                    <Input
                      id="shopping-item-name"
                      placeholder="z. B. Küchenpapier"
                      value={newItem.name}
                      onChange={(event) => setNewItem((prev) => ({ ...prev, name: event.target.value }))}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)]">
                    <div className="space-y-2">
                      <Label htmlFor="shopping-item-amount">Menge</Label>
                      <Input
                        id="shopping-item-amount"
                        placeholder="z. B. 5 oder 2,5"
                        value={newItem.amount}
                        onChange={(event) => setNewItem((prev) => ({ ...prev, amount: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shopping-item-unit">Einheit</Label>
                      <Input
                        id="shopping-item-unit"
                        placeholder="Stk, kg, Liter …"
                        value={newItem.unit}
                        onChange={(event) => setNewItem((prev) => ({ ...prev, unit: event.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shopping-item-category">Kategorie</Label>
                    <Input
                      id="shopping-item-category"
                      placeholder="z. B. Getränke"
                      list="shopping-category-suggestions"
                      value={newItem.category}
                      onChange={(event) => setNewItem((prev) => ({ ...prev, category: event.target.value }))}
                    />
                    <datalist id="shopping-category-suggestions">
                      {categoryOptions.map((option) => (
                        <option key={option} value={option} />
                      ))}
                    </datalist>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Abbrechen
                  </Button>
                  <Button onClick={handleAddItem}>Speichern</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {categoryBuckets.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/60 bg-background/70 p-6 text-center text-sm text-muted-foreground">
            Aktuell sind keine Einträge vorhanden. Sobald du in der Essensplanung konkrete Gerichte festlegst, füllen wir
            die Einkaufsliste automatisch. Eigene Ergänzungen oder geteilte Listen kannst du anschließend ergänzen.
          </p>
        ) : (
          categoryBuckets.map((bucket) => (
            <section key={bucket.name} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">{bucket.name}</h3>
                <span className="text-xs text-muted-foreground">{bucket.items.length} Positionen</span>
              </div>
              <ul className="space-y-2">
                {bucket.items.map((item) => {
                  const quantityLabel =
                    item.amount !== null
                      ? `${numberFormatter.format(item.amount)}${item.unit ? ` ${item.unit}` : ""}`
                      : item.amountText || item.unit
                        ? `${item.amountText ?? ""}${item.unit ? ` ${item.unit}` : ""}`
                        : null;
                  return (
                    <li
                      key={item.id}
                      className={cn(
                        "flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-background/80 p-3",
                        item.checked ? "opacity-60" : undefined,
                      )}
                    >
                      <label className="flex w-full items-start gap-3 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-border/60 bg-background"
                          checked={item.checked}
                          onChange={() => handleToggle(item.id)}
                        />
                        <div className="flex flex-col">
                          <span className={cn("font-medium text-foreground", item.checked ? "line-through" : undefined)}>
                            {item.name}
                          </span>
                          {quantityLabel ? (
                            <span className="text-xs text-muted-foreground">{quantityLabel}</span>
                          ) : null}
                        </div>
                      </label>
                      {item.source === "custom" ? (
                        <Badge variant="outline" className="border-primary/40 bg-primary/10 text-[10px] text-primary">
                          Individuell
                        </Badge>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </CardContent>
    </Card>
  );
}
