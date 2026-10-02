"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createLocationAction,
  deleteLocationAction,
  updateLocationAction,
} from "@/app/(members)/mitglieder/lager/actions/structure";
import { ActionDropdownMenu } from "@/components/ui/action-dropdown-menu";
import {
  ChevronRightIcon,
  EditIcon,
  MapPinIcon,
  PlusIcon,
  PrinterIcon,
  TrashIcon,
} from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { Textarea } from "@/components/ui/textarea";
import { INVENTORY_BASE_PATH, inventoryLocationPath } from "@/lib/inventory/constants";

export type LocationTreeNode = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  parentId: string | null;
  itemCount: number;
};

type Editing =
  | { mode: "create"; parentId: string | null; parentName: string | null }
  | { mode: "edit"; node: LocationTreeNode }
  | null;

/** Lagerorte als eingerückter Baum; Verwalten über Menü je Zeile. */
export function LocationTree({
  nodes,
  canManage,
}: {
  nodes: LocationTreeNode[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<Editing>(null);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const children = React.useMemo(() => {
    const map = new Map<string | null, LocationTreeNode[]>();
    for (const node of nodes) {
      const list = map.get(node.parentId) ?? [];
      list.push(node);
      map.set(node.parentId, list);
    }
    return map;
  }, [nodes]);

  const openEditor = (next: Editing) => {
    setEditing(next);
    setName(next?.mode === "edit" ? next.node.name : "");
    setDescription(next?.mode === "edit" ? (next.node.description ?? "") : "");
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const result =
      editing.mode === "create"
        ? await createLocationAction({ name, description, parentId: editing.parentId })
        : await updateLocationAction(editing.node.id, {
            name,
            description,
            parentId: editing.node.parentId,
          });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Gespeichert.");
    setEditing(null);
    router.refresh();
  };

  const remove = async (node: LocationTreeNode) => {
    const result = await deleteLocationAction(node.id);
    if (!result.ok) toast.error(result.error);
    else {
      toast.success(result.message ?? "Gelöscht.");
      router.refresh();
    }
  };

  const renderLevel = (parentId: string | null, depth: number): React.ReactNode => {
    const list = children.get(parentId) ?? [];
    if (!list.length) return null;
    return (
      <ul className={depth ? "ml-4 border-l border-border pl-2" : "divide-y divide-border"}>
        {list.map((node) => (
          <li key={node.id}>
            <div className="flex items-center gap-1">
              <Link
                href={inventoryLocationPath(node.code)}
                className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <MapPinIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {node.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    <span className="font-mono">{node.code}</span>
                    {node.itemCount ? ` · ${node.itemCount} Objekte` : ""}
                  </span>
                </span>
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
              {canManage ? (
                <ActionDropdownMenu
                  label={`Aktionen für ${node.name}`}
                  items={[
                    {
                      label: "Unterort anlegen",
                      icon: <PlusIcon />,
                      onSelect: () =>
                        openEditor({ mode: "create", parentId: node.id, parentName: node.name }),
                    },
                    {
                      label: "Umbenennen",
                      icon: <EditIcon />,
                      onSelect: () => openEditor({ mode: "edit", node }),
                    },
                    {
                      label: "Etikett drucken",
                      icon: <PrinterIcon />,
                      onSelect: () =>
                        router.push(
                          `${INVENTORY_BASE_PATH}/etiketten?codes=${encodeURIComponent(node.code)}`,
                        ),
                    },
                    {
                      label: "Löschen",
                      icon: <TrashIcon />,
                      variant: "destructive",
                      onSelect: () => remove(node),
                    },
                  ]}
                />
              ) : null}
            </div>
            {renderLevel(node.id, depth + 1)}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="space-y-3">
      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => openEditor({ mode: "create", parentId: null, parentName: null })}
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            Lager / Raum anlegen
          </Button>
          {nodes.length ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`${INVENTORY_BASE_PATH}/etiketten?quelle=orte`}>
                <PrinterIcon className="mr-2 h-4 w-4" />
                Alle Ort-Etiketten
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}
      {nodes.length ? (
        <div className="rounded-xl border border-border bg-card p-2 shadow-sm">
          {renderLevel(null, 0)}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Noch keine Lagerorte. Leg zuerst ein Lager an (z. B. „Technikraum“, „Kostümfundus“), darin
          Regale oder Fächer.
        </div>
      )}
      <ResponsivePanel
        open={editing !== null}
        onOpenChange={(open) => (!open ? setEditing(null) : undefined)}
        title={
          editing?.mode === "edit"
            ? "Ort bearbeiten"
            : editing?.parentName
              ? `Unterort in ${editing.parentName}`
              : "Lager / Raum anlegen"
        }
        description="Lagerort bearbeiten"
        footer={
          <Button className="w-full" size="lg" disabled={saving || !name.trim()} onClick={save}>
            {saving ? "Speichert …" : "Speichern"}
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="location-name">Name</Label>
            <Input
              id="location-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="z. B. Regal 3, Fach B"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="location-description">Beschreibung (optional)</Label>
            <Textarea
              id="location-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </div>
      </ResponsivePanel>
    </div>
  );
}
