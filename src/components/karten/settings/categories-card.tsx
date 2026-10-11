"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  deleteTicketCategoryAction,
  moveTicketCategoryAction,
  saveTicketCategoryAction,
} from "@/app/(members)/mitglieder/karten/einstellungen/actions";
import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  EditIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/ui/action-icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModalFormDialog } from "@/components/ui/modal-form-dialog";
import { Switch } from "@/components/ui/switch";
import { formatPrice, parsePriceToCents } from "@/lib/karten/constants";

export type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  needsSeat: boolean;
  onlineBookable: boolean;
  isActive: boolean;
};

type Draft = {
  name: string;
  description: string;
  price: string;
  needsSeat: boolean;
  onlineBookable: boolean;
  isActive: boolean;
};

const EMPTY: Draft = {
  name: "",
  description: "",
  price: "",
  needsSeat: true,
  onlineBookable: true,
  isActive: true,
};

const SUGGESTIONS = ["Erwachsene", "Kinder", "Ermäßigt"];

export function CategoriesCard({
  showId,
  categories,
}: {
  showId: string;
  categories: CategoryRow[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [deleting, setDeleting] = useState<CategoryRow | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (operation: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    startTransition(async () => {
      const result = await operation();
      if (result.ok) {
        if (result.message) toast.success(result.message);
        setEditing(null);
        router.refresh();
      } else {
        toast.error(result.error ?? "Fehlgeschlagen.");
      }
    });

  const save = () => {
    if (!editing) return;
    const priceCents = parsePriceToCents(editing.draft.price);
    if (priceCents === null) {
      toast.error("Bitte einen gültigen Preis angeben, z. B. 12,50.");
      return;
    }
    const { draft } = editing;
    run(() =>
      saveTicketCategoryAction(showId, editing.id, {
        name: draft.name,
        description: draft.description,
        priceCents,
        needsSeat: draft.needsSeat,
        onlineBookable: draft.onlineBookable,
        isActive: draft.isActive,
      }),
    );
  };

  const setDraft = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setEditing((current) =>
      current ? { ...current, draft: { ...current.draft, [key]: value } } : current,
    );

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Kartenarten</h2>
          <p className="text-sm text-muted-foreground">
            Reihenfolge wie auf der Buchungsseite. Preise werden vorerst an der Abendkasse bezahlt.
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing({ id: null, draft: EMPTY })}>
          <PlusIcon /> Kartenart
        </Button>
      </div>

      {categories.length === 0 ? (
        <div className="space-y-3 py-8 text-center text-sm text-muted-foreground">
          <p>Noch keine Kartenarten. Ohne Kartenart kann niemand buchen.</p>
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((name) => (
              <Button
                key={name}
                size="xs"
                variant="outline"
                onClick={() => setEditing({ id: null, draft: { ...EMPTY, name } })}
              >
                <PlusIcon /> {name}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-border/60 rounded-md border border-border/60">
          {categories.map((category, index) => (
            <li key={category.id} className="flex min-h-12 flex-wrap items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{category.name}</span>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {category.priceCents > 0 ? formatPrice(category.priceCents) : "kostenlos"}
                  </span>
                  {!category.needsSeat ? (
                    <Badge variant="muted" size="sm">
                      ohne Platz
                    </Badge>
                  ) : null}
                  {!category.onlineBookable ? (
                    <Badge variant="muted" size="sm">
                      nur Kasse
                    </Badge>
                  ) : null}
                  {!category.isActive ? (
                    <Badge variant="warning" size="sm">
                      inaktiv
                    </Badge>
                  ) : null}
                </div>
                {category.description ? (
                  <p className="text-xs text-muted-foreground">{category.description}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Nach oben"
                  disabled={index === 0 || pending}
                  onClick={() => run(() => moveTicketCategoryAction(category.id, -1))}
                >
                  <ChevronUpIcon />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Nach unten"
                  disabled={index === categories.length - 1 || pending}
                  onClick={() => run(() => moveTicketCategoryAction(category.id, 1))}
                >
                  <ChevronDownIcon />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`${category.name} bearbeiten`}
                  onClick={() =>
                    setEditing({
                      id: category.id,
                      draft: {
                        name: category.name,
                        description: category.description ?? "",
                        price: category.priceCents
                          ? (category.priceCents / 100).toFixed(2).replace(".", ",")
                          : "",
                        needsSeat: category.needsSeat,
                        onlineBookable: category.onlineBookable,
                        isActive: category.isActive,
                      },
                    })
                  }
                >
                  <EditIcon />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`${category.name} löschen`}
                  onClick={() => setDeleting(category)}
                >
                  <TrashIcon />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ModalFormDialog
        title={editing?.id ? "Kartenart bearbeiten" : "Neue Kartenart"}
        open={editing !== null}
        onOpenChange={(open) => (!open ? setEditing(null) : undefined)}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Abbrechen
            </Button>
            <AsyncButton isLoading={pending} onClick={save}>
              Speichern
            </AsyncButton>
          </>
        }
      >
        {editing ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <div className="space-y-1.5">
                <Label htmlFor="category-name">Name</Label>
                <Input
                  id="category-name"
                  autoFocus
                  value={editing.draft.name}
                  onChange={(event) => setDraft("name", event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category-price">Preis (€)</Label>
                <Input
                  id="category-price"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={editing.draft.price}
                  onChange={(event) => setDraft("price", event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category-description">Hinweis (optional)</Label>
              <Input
                id="category-description"
                placeholder="z. B. bis 14 Jahre"
                value={editing.draft.description}
                onChange={(event) => setDraft("description", event.target.value)}
              />
            </div>
            <ToggleRow
              label="Belegt einen Platz"
              hint="Aus für Kleinkinder auf dem Schoß – sie zählen dann nicht gegen die Kapazität."
              checked={editing.draft.needsSeat}
              onChange={(value) => setDraft("needsSeat", value)}
            />
            <ToggleRow
              label="Online buchbar"
              hint="Aus: nur über Kartenbüro und Abendkasse (z. B. Rollstuhlplatz)."
              checked={editing.draft.onlineBookable}
              onChange={(value) => setDraft("onlineBookable", value)}
            />
            <ToggleRow
              label="Aktiv"
              checked={editing.draft.isActive}
              onChange={(value) => setDraft("isActive", value)}
            />
            <button type="submit" hidden />
          </form>
        ) : null}
      </ModalFormDialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (!open ? setDeleting(null) : undefined)}
        title={`„${deleting?.name ?? ""}“ löschen?`}
        description="Gibt es schon Buchungen mit dieser Kartenart, wird sie nur deaktiviert."
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (target) run(() => deleteTicketCategoryAction(target.id));
        }}
      />
    </Card>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md bg-muted/40 p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
