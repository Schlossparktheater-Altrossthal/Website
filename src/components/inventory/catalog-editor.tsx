"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  deleteCategoryAction,
  deleteFieldAction,
  moveFieldAction,
  saveCategoryAction,
  saveFieldAction,
  type FieldTarget,
} from "@/app/(members)/mitglieder/lager/actions/catalog";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  EditIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  categoryPath,
  FIELD_TYPE_LABELS,
  FIELD_TYPES,
  type FieldDef,
  type FieldType,
} from "@/lib/inventory/specs";
import { cn } from "@/lib/utils";

export type CatalogField = FieldDef & { id: string };
export type CatalogCategory = {
  id: string;
  parentId: string | null;
  name: string;
  fields: CatalogField[];
  productCount: number;
};
export type CatalogArea = {
  id: string;
  name: string;
  prefix: string;
  fields: CatalogField[];
  categories: CatalogCategory[];
};

type Result = { ok: boolean; error?: string; message?: string };
const ROOT = "__root__";

/**
 * Katalogpflege: je Bereich ein Kategorienbaum, an jeder Ebene Merkmale, die nach unten vererbt
 * werden (Ton › Mikrofone: Richtcharakteristik gilt auch für Kondensator).
 */
export function CatalogEditor({ areas }: { areas: CatalogArea[] }) {
  const router = useRouter();
  const [areaId, setAreaId] = React.useState(areas[0]?.id ?? "");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [newRoot, setNewRoot] = React.useState("");
  const area = areas.find((entry) => entry.id === areaId);

  const run = React.useCallback(
    async (promise: Promise<Result>) => {
      const result = await promise;
      if (!result.ok) {
        toast.error(result.error ?? "Fehler");
        return false;
      }
      if (result.message) toast.success(result.message);
      router.refresh();
      return true;
    },
    [router],
  );

  if (!area) return <p className="text-sm text-muted-foreground">Noch keine Bereiche.</p>;

  const children = (parentId: string | null) =>
    area.categories.filter((category) => category.parentId === parentId);
  const open = openId === ROOT ? null : area.categories.find((entry) => entry.id === openId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Bereich">
        {areas.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={entry.id === areaId}
            onClick={() => setAreaId(entry.id)}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              entry.id === areaId
                ? "border-primary bg-primary/15 text-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="font-mono text-xs">{entry.prefix}</span>
            {entry.name}
          </button>
        ))}
      </div>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground">Merkmale für den ganzen Bereich</h2>
            <p className="text-xs text-muted-foreground">
              Gelten für alle Artikel in {area.name}, egal in welcher Kategorie.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setOpenId(ROOT)}>
            <EditIcon className="mr-2 h-4 w-4" />
            Bearbeiten
          </Button>
        </div>
        <FieldChips fields={area.fields} empty="Keine – Merkmale stehen an den Kategorien." />
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div>
          <h2 className="font-semibold text-foreground">Kategorien</h2>
          <p className="text-xs text-muted-foreground">
            Antippen zum Bearbeiten. Unterkategorien erben die Merkmale ihrer Oberkategorie.
          </p>
        </div>
        <ul className="space-y-1" role="tree" aria-label={`Kategorien in ${area.name}`}>
          {children(null).map((category) => (
            <CategoryNode
              key={category.id}
              category={category}
              childrenOf={children}
              depth={0}
              onOpen={setOpenId}
            />
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await run(saveCategoryAction(area.id, null, { name: newRoot, parentId: null }))) {
              setNewRoot("");
            }
          }}
        >
          <Input
            value={newRoot}
            onChange={(event) => setNewRoot(event.target.value)}
            placeholder="Neue Hauptkategorie"
            aria-label={`Neue Hauptkategorie in ${area.name}`}
            className="h-9 min-w-0 flex-1"
          />
          <Button type="submit" size="sm" variant="outline" disabled={!newRoot.trim()}>
            <PlusIcon className="mr-1.5 h-4 w-4" />
            Hinzufügen
          </Button>
        </form>
      </section>

      <ResponsivePanel
        open={openId !== null}
        onOpenChange={(value) => (!value ? setOpenId(null) : undefined)}
        title={open ? open.name : `Merkmale: ${area.name}`}
        description={
          open
            ? (categoryPath(area.categories, open.id)
                .map((entry) => entry.name)
                .join(" › ") ?? "")
            : "Gelten für den ganzen Bereich"
        }
      >
        {openId === ROOT ? (
          <FieldList
            key={`area-${area.id}`}
            target={{ type: "area", id: area.id }}
            fields={area.fields}
            inherited={[]}
            run={run}
          />
        ) : open ? (
          <CategoryPanel
            key={open.id}
            area={area}
            category={open}
            run={run}
            onOpen={setOpenId}
            onDeleted={() => setOpenId(null)}
          />
        ) : null}
      </ResponsivePanel>
    </div>
  );
}

function CategoryNode({
  category,
  childrenOf,
  depth,
  onOpen,
}: {
  category: CatalogCategory;
  childrenOf: (parentId: string | null) => CatalogCategory[];
  depth: number;
  onOpen: (id: string) => void;
}) {
  const kids = childrenOf(category.id);
  const [expanded, setExpanded] = React.useState(depth === 0);
  return (
    <li role="treeitem" aria-expanded={kids.length ? expanded : undefined}>
      <div
        className="flex items-center gap-1 rounded-md hover:bg-muted/60"
        style={{ paddingLeft: `${depth * 1.25}rem` }}
      >
        {kids.length ? (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
            aria-label={expanded ? `${category.name} zuklappen` : `${category.name} aufklappen`}
          >
            {expanded ? <ChevronDownIcon /> : <ChevronRightIcon className="h-4 w-4" />}
          </button>
        ) : (
          <span className="h-8 w-8 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => onOpen(category.id)}
          className="flex min-h-10 min-w-0 flex-1 items-center justify-between gap-3 py-1.5 pr-2 text-left"
        >
          <span className="truncate text-sm font-medium text-foreground">{category.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {[
              category.fields.length
                ? `${category.fields.length} ${category.fields.length === 1 ? "Merkmal" : "Merkmale"}`
                : null,
              category.productCount ? `${category.productCount} Artikel` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </button>
      </div>
      {kids.length && expanded ? (
        <ul role="group" className="space-y-1">
          {kids.map((child) => (
            <CategoryNode
              key={child.id}
              category={child}
              childrenOf={childrenOf}
              depth={depth + 1}
              onOpen={onOpen}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function CategoryPanel({
  area,
  category,
  run,
  onOpen,
  onDeleted,
}: {
  area: CatalogArea;
  category: CatalogCategory;
  run: (promise: Promise<Result>) => Promise<boolean>;
  onOpen: (id: string) => void;
  onDeleted: () => void;
}) {
  const [name, setName] = React.useState(category.name);
  const [parentId, setParentId] = React.useState(category.parentId ?? ROOT);
  const [child, setChild] = React.useState("");
  const path = categoryPath(area.categories, category.id);
  const inherited = [
    ...area.fields.map((field) => ({ field, from: area.name })),
    ...path
      .slice(0, -1)
      .flatMap((entry) => entry.fields.map((field) => ({ field, from: entry.name }))),
  ];
  // Mögliche Oberkategorien: alle außer sich selbst und den eigenen Unterkategorien.
  const descendants = new Set<string>([category.id]);
  for (let changed = true; changed;) {
    changed = false;
    for (const entry of area.categories) {
      if (entry.parentId && descendants.has(entry.parentId) && !descendants.has(entry.id)) {
        descendants.add(entry.id);
        changed = true;
      }
    }
  }
  const parents = area.categories
    .filter((entry) => !descendants.has(entry.id))
    .map((entry) => ({
      id: entry.id,
      label: categoryPath(area.categories, entry.id)
        .map((item) => item.name)
        .join(" › "),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "de"));
  const dirty = name.trim() !== category.name || parentId !== (category.parentId ?? ROOT);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="category-name">Name</Label>
          <Input
            id="category-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Liegt unter</Label>
          <Select value={parentId} onValueChange={setParentId}>
            <SelectTrigger aria-label="Oberkategorie">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ROOT}>– Hauptkategorie –</SelectItem>
              {parents.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {dirty ? (
        <Button
          size="sm"
          disabled={!name.trim()}
          onClick={() =>
            run(
              saveCategoryAction(area.id, category.id, {
                name,
                parentId: parentId === ROOT ? null : parentId,
              }),
            )
          }
        >
          Name/Lage speichern
        </Button>
      ) : null}

      <FieldList
        target={{ type: "category", id: category.id }}
        fields={category.fields}
        inherited={inherited}
        run={run}
      />

      <div className="space-y-2 border-t border-border pt-4">
        <Label htmlFor="category-child">Unterkategorie anlegen</Label>
        <form
          className="flex gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const result = await saveCategoryAction(area.id, null, {
              name: child,
              parentId: category.id,
            });
            if (await run(Promise.resolve(result))) {
              setChild("");
              if (result.ok && result.data) onOpen(result.data.id);
            }
          }}
        >
          <Input
            id="category-child"
            value={child}
            onChange={(event) => setChild(event.target.value)}
            placeholder={`z. B. unter ${category.name}`}
            className="h-9 min-w-0 flex-1"
          />
          <Button type="submit" size="sm" variant="outline" disabled={!child.trim()}>
            <PlusIcon className="mr-1.5 h-4 w-4" />
            Anlegen
          </Button>
        </form>
      </div>

      <div className="border-t border-border pt-4">
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={async () => {
            if (!window.confirm(`Kategorie „${category.name}“ löschen?`)) return;
            if (await run(deleteCategoryAction(category.id))) onDeleted();
          }}
        >
          <TrashIcon className="mr-2 h-4 w-4" />
          Kategorie löschen
        </Button>
        {category.productCount ? (
          <p className="text-xs text-muted-foreground">
            Geht erst, wenn keine Artikel mehr darin liegen ({category.productCount}).
          </p>
        ) : null}
      </div>
    </div>
  );
}

function FieldChips({ fields, empty }: { fields: FieldDef[]; empty: string }) {
  if (!fields.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {fields.map((field) => (
        <span
          key={field.key}
          className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-foreground"
        >
          {field.label}
          {field.unit ? ` (${field.unit})` : ""}
          <span className="text-muted-foreground"> · {FIELD_TYPE_LABELS[field.type]}</span>
        </span>
      ))}
    </div>
  );
}

type FieldDraft = {
  id: string | null;
  label: string;
  type: FieldType;
  unit: string;
  placeholder: string;
  required: boolean;
  options: string;
};

const emptyDraft: FieldDraft = {
  id: null,
  label: "",
  type: "text",
  unit: "",
  placeholder: "",
  required: false,
  options: "",
};

function FieldList({
  target,
  fields,
  inherited,
  run,
}: {
  target: FieldTarget;
  fields: CatalogField[];
  inherited: { field: FieldDef; from: string }[];
  run: (promise: Promise<Result>) => Promise<boolean>;
}) {
  const [draft, setDraft] = React.useState<FieldDraft | null>(null);
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const ok = await run(
      saveFieldAction(target, draft.id, {
        label: draft.label,
        type: draft.type,
        unit: draft.unit,
        placeholder: draft.placeholder,
        required: draft.required,
        options: draft.options
          .split(/[\n,;]/)
          .map((option) => option.trim())
          .filter(Boolean),
      }),
    );
    setSaving(false);
    if (ok) setDraft(null);
  };

  if (draft) {
    return (
      <div className="space-y-3 rounded-lg border border-primary/40 p-3">
        <p className="text-sm font-semibold text-foreground">
          {draft.id ? "Merkmal bearbeiten" : "Neues Merkmal"}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="field-label">Bezeichnung</Label>
            <Input
              id="field-label"
              autoFocus
              value={draft.label}
              placeholder="z. B. Leistung, Richtcharakteristik"
              onChange={(event) => setDraft({ ...draft, label: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Art</Label>
            <Select
              value={draft.type}
              onValueChange={(type) => setDraft({ ...draft, type: type as FieldType })}
            >
              <SelectTrigger aria-label="Art des Merkmals">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {FIELD_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {draft.type === "select" ? (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="field-options">Auswahlwerte</Label>
              <Input
                id="field-options"
                value={draft.options}
                placeholder="Niere, Superniere, Kugel"
                onChange={(event) => setDraft({ ...draft, options: event.target.value })}
              />
              <p className="text-xs text-muted-foreground">Mit Komma getrennt.</p>
            </div>
          ) : null}
          {draft.type === "number" || draft.type === "text" ? (
            <div className="space-y-1.5">
              <Label htmlFor="field-unit">Einheit</Label>
              <Input
                id="field-unit"
                value={draft.unit}
                placeholder="z. B. W, kg, m"
                onChange={(event) => setDraft({ ...draft, unit: event.target.value })}
              />
            </div>
          ) : null}
          {draft.type !== "boolean" && draft.type !== "select" ? (
            <div className="space-y-1.5">
              <Label htmlFor="field-placeholder">Beispiel</Label>
              <Input
                id="field-placeholder"
                value={draft.placeholder}
                placeholder="erscheint grau im Feld"
                onChange={(event) => setDraft({ ...draft, placeholder: event.target.value })}
              />
            </div>
          ) : null}
        </div>
        {draft.type !== "boolean" ? (
          <label className="flex items-center justify-between gap-3 text-sm">
            Pflichtangabe beim Erfassen
            <Switch
              checked={draft.required}
              onCheckedChange={(required) => setDraft({ ...draft, required })}
              aria-label="Pflichtangabe"
            />
          </label>
        ) : null}
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={saving || !draft.label.trim()}>
            {saving ? "Speichert …" : "Speichern"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDraft(null)}>
            Abbrechen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Eigene Merkmale</h3>
        <Button size="sm" variant="outline" onClick={() => setDraft(emptyDraft)}>
          <PlusIcon className="mr-1.5 h-4 w-4" />
          Merkmal
        </Button>
      </div>
      {fields.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {fields.map((field, index) => (
            <li key={field.id} className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {field.label}
                  {field.unit ? ` (${field.unit})` : ""}
                  {field.required ? " *" : ""}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {FIELD_TYPE_LABELS[field.type]}
                  {field.options.length ? `: ${field.options.join(", ")}` : ""}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                disabled={index === 0}
                aria-label={`${field.label} nach oben`}
                onClick={() => run(moveFieldAction(field.id, "up"))}
              >
                <ChevronUpIcon className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                disabled={index === fields.length - 1}
                aria-label={`${field.label} nach unten`}
                onClick={() => run(moveFieldAction(field.id, "down"))}
              >
                <ChevronDownIcon className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                aria-label={`${field.label} bearbeiten`}
                onClick={() =>
                  setDraft({
                    id: field.id,
                    label: field.label,
                    type: field.type,
                    unit: field.unit ?? "",
                    placeholder: field.placeholder ?? "",
                    required: field.required,
                    options: field.options.join(", "),
                  })
                }
              >
                <EditIcon className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                aria-label={`${field.label} löschen`}
                onClick={() => {
                  if (
                    window.confirm(
                      `Merkmal „${field.label}“ löschen? Eingetragene Werte werden ausgeblendet.`,
                    )
                  ) {
                    void run(deleteFieldAction(field.id));
                  }
                }}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Noch keine eigenen Merkmale.</p>
      )}
      {inherited.length ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Geerbt</p>
          <div className="flex flex-wrap gap-1.5">
            {inherited.map(({ field, from }) => (
              <span
                key={`${from}-${field.key}`}
                className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground"
              >
                {field.label} · aus {from}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
