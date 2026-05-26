"use client";

import { useMemo, useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ModalFormDialog } from "@/components/ui/modal-form-dialog";
import { DndSortableProvider, horizontalListSortingStrategy, SortableContext, SortableItem } from "@/components/ui/sortable";
import { ChevronDownIcon, ChevronUpIcon, EditIcon, GripVerticalIcon, PlusIcon, SearchIcon } from "@/components/ui/action-icons";
import { toast } from "sonner";

export type PermissionWorkbenchPermission = { id: string; key: string; label: string; description: string | null; categoryKey: string; categoryLabel: string; };
export type PermissionWorkbenchRole = { id: string; name: string; isSystem: boolean; systemRole: string | null; sortIndex: number; };
export type RoleGrantState = Record<string, Set<string>>;
const CATEGORY_ORDER = ["base", "rehearsal", "department", "pages", "admin", "public", "communication", "analytics"] as const;
const GROUPS = [
  { id: "group-base-access", category: "base", label: "Allgemeiner Zugang", description: "Steuert den grundlegenden Mitgliederzugang.", keys: ["PRIVATE.DASHBOARD.OVERVIEW.VIEW", "PRIVATE.PROFILE.OWN.VIEW"] },
  { id: "group-department-costume", category: "department", label: "Kostüm & Verpflegung", description: "Bündelt Freigaben für Maße, Größen und Ernährung.", keys: ["PRIVATE.PROFILE.MEASUREMENTS.MANAGE", "PRIVATE.PROFILE.SIZES.MANAGE", "PRIVATE.PROFILE.DIETARY.MANAGE"] },
  { id: "group-public-content", category: "public", label: "Öffentliche Inhalte", description: "Regelt zentrale Inhalte der öffentlichen Website.", keys: ["PUBLIC.HOME.COUNTDOWN.EDIT", "PUBLIC.CONTENT.MANAGE"] },
] as const;

function toGrantState(record: Record<string, string[]>) { const n: RoleGrantState = {}; for (const [k, v] of Object.entries(record)) n[k] = new Set(v); return n; }

export function PermissionWorkbenchClient({ permissions, roles: initialRoles, roleGrants: initialRoleGrants }: { permissions: PermissionWorkbenchPermission[]; roles: PermissionWorkbenchRole[]; systemRoles: PermissionWorkbenchRole[]; departments: unknown[]; roleGrants: Record<string, string[]>; departmentGrants: Record<string, string[]>; }) {
  const [roles, setRoles] = useState(initialRoles);
  const [roleOrder, setRoleOrder] = useState(initialRoles.map((role) => role.id));
  const [roleGrants, setRoleGrants] = useState<RoleGrantState>(() => toGrantState(initialRoleGrants));
  const [search, setSearch] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<PermissionWorkbenchRole | null>(null);
  const [roleName, setRoleName] = useState("");

  const hasSearch = search.trim().length > 0;
  const orderedRoles = useMemo(() => roleOrder.map((id) => roles.find((role) => role.id === id)).filter((r): r is PermissionWorkbenchRole => Boolean(r)), [roleOrder, roles]);

  const categories = useMemo(() => {
    const term = search.trim().toLowerCase();
    return CATEGORY_ORDER.map((categoryKey) => {
      const categoryPermissions = permissions.filter((p) => p.categoryKey === categoryKey);
      const groups = GROUPS.filter((g) => g.category === categoryKey).map((group) => {
        const members = categoryPermissions.filter((p) => group.keys.includes(p.key));
        const filtered = members.filter((m) => !term || [m.label, m.key, m.description ?? ""].join(" ").toLowerCase().includes(term));
        return { ...group, members: filtered, hasMatch: filtered.length > 0 };
      }).filter((g) => g.hasMatch);
      const groupedKeys = new Set(groups.flatMap((g) => g.keys));
      const singles = categoryPermissions.filter((p) => !groupedKeys.has(p.key)).filter((m) => !term || [m.label, m.key, m.description ?? ""].join(" ").toLowerCase().includes(term));
      return { categoryKey, categoryLabel: categoryPermissions[0]?.categoryLabel ?? categoryKey, groups, singles };
    }).filter((c) => c.groups.length > 0 || c.singles.length > 0);
  }, [permissions, search]);

  const togglePermission = async (roleId: string, permissionKey: string, grant: boolean) => {
    setRoleGrants((current) => ({ ...current, [roleId]: new Set(grant ? [...(current[roleId] ?? []), permissionKey] : [...(current[roleId] ?? [])].filter((k) => k !== permissionKey)) }));
    const response = await fetch("/api/permissions/definitions", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ permissionKey, roleId, grant }) });
    if (!response.ok) {
      setRoleGrants((current) => ({ ...current, [roleId]: new Set(grant ? [...(current[roleId] ?? [])].filter((k) => k !== permissionKey) : [...(current[roleId] ?? []), permissionKey]) }));
      toast.error("Rechtezuweisung fehlgeschlagen", { duration: 5000 });
    }
  };

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-md"><SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechte durchsuchen…" /></div>
      <Button type="button" onClick={() => { setRoleName(""); setCreateOpen(true); }}><PlusIcon className="size-4" />Neue Rolle</Button>
    </div>
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <DndSortableProvider onDragEnd={async ({ active, over }) => { if (!over || active.id === over.id) return; const oldIndex = roleOrder.indexOf(String(active.id)); const newIndex = roleOrder.indexOf(String(over.id)); const next = arrayMove(roleOrder, oldIndex, newIndex); setRoleOrder(next); await fetch('/api/permissions/roles/order', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ roleIds: next })}); }}>
      <table className="min-w-full border-collapse text-sm"><thead className="sticky top-0 z-10 bg-card"><tr><th className="min-w-96 border-b border-border bg-card p-3 text-left text-foreground">Berechtigung</th><th className="p-0" colSpan={orderedRoles.length}><SortableContext items={roleOrder} strategy={horizontalListSortingStrategy}><div className="grid" style={{ gridTemplateColumns: `repeat(${orderedRoles.length}, minmax(12rem, 1fr))` }}>{orderedRoles.map((role) => <SortableItem key={role.id} id={role.id}>{({ attributes, listeners, setNodeRef, transform, transition }) => <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="sticky top-0 z-10 border-b border-l border-border bg-card p-3"><div className="flex items-center justify-between gap-2"><span className="font-medium">{role.name}</span><div className="flex items-center gap-1"><button type="button" className="rounded p-1 hover:bg-muted" onClick={() => { setRoleName(role.name); setEditRole(role); }}><EditIcon className="size-4" /></button><button type="button" className="cursor-grab rounded p-1 hover:bg-muted" {...attributes} {...listeners}><GripVerticalIcon className="size-4" /></button></div></div></div>}</SortableItem>)}</div></SortableContext></th></tr></thead><tbody>
      {categories.map((category) => { const forcedOpen = hasSearch; const isOpen = forcedOpen || !(collapsedCategories[category.categoryKey] ?? true); return <Collapsible key={category.categoryKey} open={isOpen} onOpenChange={(open) => !forcedOpen && setCollapsedCategories((s) => ({ ...s, [category.categoryKey]: !open }))} asChild><>
      <tr className="bg-muted"><td colSpan={orderedRoles.length + 1} className="border-b border-border p-0"><CollapsibleTrigger className="flex min-h-11 w-full items-center justify-between px-3 py-2 text-left"><span className="font-medium">{category.categoryLabel}</span>{isOpen ? <ChevronUpIcon className="size-4 text-muted-foreground" /> : <ChevronDownIcon className="size-4 text-muted-foreground" />}</CollapsibleTrigger></td></tr>
      <CollapsibleContent asChild>{<>{category.groups.map((group) => { const groupOpen = openGroups[group.id] ?? hasSearch; return <><tr key={group.id} className="bg-card"><td className="border-b border-border p-3"><button type="button" className="flex w-full items-start justify-between text-left" onClick={() => setOpenGroups((s) => ({ ...s, [group.id]: !groupOpen }))}><span><span className="font-medium text-foreground">{group.label}</span><span className="block text-xs text-muted-foreground">{group.description}</span></span>{groupOpen ? <ChevronUpIcon className="mt-0.5 size-4 text-muted-foreground" /> : <ChevronDownIcon className="mt-0.5 size-4 text-muted-foreground" />}</button></td>{orderedRoles.map((role) => { const granted = group.keys.filter((key) => roleGrants[role.id]?.has(key)).length; const all = granted === group.keys.length; const some = granted > 0 && !all; return <td key={role.id} className="border-b border-l border-border p-3 text-center"><Checkbox checked={all ? true : some ? "indeterminate" : false} onCheckedChange={(state) => { const grant = state === true; void Promise.all(group.keys.map((permissionKey) => togglePermission(role.id, permissionKey, grant))); }} /></td>; })}</tr>{groupOpen && group.members.map((permission) => <tr key={permission.key} className="bg-muted/30"><td className="border-b border-border p-3 pl-8"><p className="text-foreground">{permission.label}</p><p className="text-xs text-muted-foreground">{permission.description ?? permission.key}</p></td>{orderedRoles.map((role) => <td key={role.id} className="border-b border-l border-border p-3 text-center"><Checkbox disabled checked={roleGrants[role.id]?.has(permission.key) ?? false} /></td>)}</tr>)}</>; })}
      {category.singles.map((permission, idx) => <tr key={permission.key} className={idx % 2 === 0 ? "bg-card" : "bg-muted/30"}><td className="border-b border-border p-3"><p className="text-foreground">{permission.label}</p><p className="text-xs text-muted-foreground">{permission.description ?? permission.key}</p></td>{orderedRoles.map((role) => <td key={role.id} className="border-b border-l border-border p-3 text-center"><Checkbox checked={roleGrants[role.id]?.has(permission.key) ?? false} onCheckedChange={(checked) => void togglePermission(role.id, permission.key, checked === true)} /></td>)}</tr>)}
      </>}</CollapsibleContent></></Collapsible>; })}
      </tbody></table></DndSortableProvider>
    </div>

    <ModalFormDialog open={createOpen} onOpenChange={setCreateOpen} title="Neue Rolle" description="Lege eine neue Rolle an." confirmLabel="Speichern" onConfirm={async () => { const response = await fetch('/api/permissions/roles', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: roleName })}); if (!response.ok) { toast.error('Rolle konnte nicht erstellt werden', { duration: 5000 }); return; } const data = await response.json() as { role: PermissionWorkbenchRole }; setRoles((r) => [...r, data.role]); setRoleOrder((o) => [...o, data.role.id]); setCreateOpen(false); toast.success('Rolle erstellt', { duration: 3000 }); }}><Input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="Rollenname" /></ModalFormDialog>

    <ModalFormDialog open={Boolean(editRole)} onOpenChange={(open) => { if (!open) setEditRole(null); }} title="Rolle bearbeiten" description="Passe den Rollennamen an." confirmLabel="Speichern" onConfirm={async () => { if (!editRole) return; const response = await fetch(`/api/permissions/roles/${editRole.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: roleName })}); if (!response.ok) { toast.error('Rolle konnte nicht aktualisiert werden', { duration: 5000 }); return; } setRoles((curr) => curr.map((r) => r.id === editRole.id ? { ...r, name: roleName } : r)); setEditRole(null); toast.success('Rolle aktualisiert', { duration: 3000 }); }}><Input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="Rollenname" /></ModalFormDialog>
  </div>;
}

export default PermissionWorkbenchClient;
