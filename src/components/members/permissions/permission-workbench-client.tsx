"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { ChevronDownIcon, ChevronUpIcon, EditIcon, GripVerticalIcon, PlusIcon, SearchIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ModalFormDialog } from "@/components/ui/modal-form-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DndSortableProvider, horizontalListSortingStrategy, SortableContext, SortableItem } from "@/components/ui/sortable";
import { toast } from "sonner";

import type { PermissionWorkbenchPermission, PermissionWorkbenchRole, RoleGrantState } from "@/components/members/permissions/permission-workbench-types";
const CATEGORY_ORDER = ["base", "rehearsal", "department", "pages", "admin", "public", "communication", "analytics"] as const;
type PermissionGroup = { id: string; category: string; label: string; description: string; keys: string[] };
const GROUPS: PermissionGroup[] = [
  { id: "group-base-access", category: "base", label: "Allgemeiner Zugang", description: "Steuert den grundlegenden Mitgliederzugang.", keys: ["PRIVATE.DASHBOARD.OVERVIEW.VIEW", "PRIVATE.PROFILE.OWN.VIEW"] },
  { id: "group-department-costume", category: "department", label: "Kostüm & Verpflegung", description: "Bündelt Freigaben für Maße, Größen und Ernährung.", keys: ["PRIVATE.PROFILE.MEASUREMENTS.MANAGE", "PRIVATE.PROFILE.SIZES.MANAGE", "PRIVATE.PROFILE.DIETARY.MANAGE"] },
  { id: "group-public-content", category: "public", label: "Öffentliche Inhalte", description: "Regelt zentrale Inhalte der öffentlichen Website.", keys: ["PUBLIC.HOME.COUNTDOWN.EDIT", "PUBLIC.CONTENT.MANAGE"] },
];

function toGrantState(record: Record<string, string[]>) {
  const next: RoleGrantState = {};
  for (const [key, values] of Object.entries(record)) next[key] = new Set(values);
  return next;
}

export function PermissionWorkbenchClient({ permissions, roles: initialRoles, roleGrants: initialRoleGrants }: { permissions: PermissionWorkbenchPermission[]; roles: PermissionWorkbenchRole[]; systemRoles: PermissionWorkbenchRole[]; departments: unknown[]; roleGrants: Record<string, string[]>; departmentGrants: Record<string, string[]> }) {
  const [roles, setRoles] = useState(initialRoles);
  const [roleOrder, setRoleOrder] = useState(initialRoles.map((role) => role.id));
  const [roleGrants, setRoleGrants] = useState<RoleGrantState>(() => toGrantState(initialRoleGrants));
  const [search, setSearch] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<PermissionWorkbenchRole | null>(null);
  const [roleName, setRoleName] = useState("");
  const [mobileSelectedRoleId, setMobileSelectedRoleId] = useState<string>("");

  const hasSearch = search.trim().length > 0;
  const orderedRoles = useMemo(() => roleOrder.map((id) => roles.find((role) => role.id === id)).filter((r): r is PermissionWorkbenchRole => Boolean(r)), [roleOrder, roles]);

  useEffect(() => {
    if (!mobileSelectedRoleId && orderedRoles.length > 0) {
      setMobileSelectedRoleId(orderedRoles[0].id);
    }
  }, [mobileSelectedRoleId, orderedRoles]);

  const categories = useMemo(() => {
    const term = search.trim().toLowerCase();
    return CATEGORY_ORDER.map((categoryKey) => {
      const categoryPermissions = permissions.filter((p) => p.categoryKey === categoryKey);
      const groups = GROUPS.filter((g) => g.category === categoryKey)
        .map((group) => {
          const members = categoryPermissions.filter((p) => group.keys.includes(p.key));
          const filtered = members.filter((m) => !term || [m.label, m.key, m.description ?? ""].join(" ").toLowerCase().includes(term));
          return { ...group, members: filtered, hasMatch: filtered.length > 0 };
        })
        .filter((g) => g.hasMatch);
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

    <div className="block space-y-4 md:hidden">
      <Select value={mobileSelectedRoleId} onValueChange={setMobileSelectedRoleId}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Rolle auswählen" />
        </SelectTrigger>
        <SelectContent>
          {orderedRoles.map((role) => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}
        </SelectContent>
      </Select>

      {!mobileSelectedRoleId ? <p className="py-8 text-center text-sm text-muted-foreground">Bitte wähle eine Rolle aus.</p> : categories.map((category) => <Collapsible key={`mobile-${category.categoryKey}`} defaultOpen={false} className="space-y-1">
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-muted px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span>{category.categoryLabel}</span>
          <ChevronDownIcon className="size-4" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="overflow-hidden rounded-lg border border-border">
            {category.groups.map((group) => {
              const grantedCount = group.keys.filter((key) => roleGrants[mobileSelectedRoleId]?.has(key)).length;
              const allGranted = grantedCount === group.keys.length;
              const someGranted = grantedCount > 0 && !allGranted;
              return <div key={`mobile-${group.id}`}>
                <div className="flex items-center justify-between bg-muted/40 px-4 py-2">
                  <div>
                    <span className="text-sm font-medium text-foreground">{group.label}</span>
                    <span className="block text-xs text-muted-foreground">{group.description}</span>
                  </div>
                  <Checkbox checked={allGranted ? true : someGranted ? "indeterminate" : false} onCheckedChange={(state) => { const grant = state === true; void Promise.all(group.keys.map((permissionKey) => togglePermission(mobileSelectedRoleId, permissionKey, grant))); }} />
                </div>
                {group.members.map((permission) => <div key={`mobile-member-${permission.key}`} className="border-b border-border/40 bg-card px-4 py-3 pl-8 last:border-b-0">
                  <span className="block text-sm font-medium text-foreground">{permission.label}</span>
                  <span className="block text-xs text-muted-foreground">{permission.description ?? "Keine Beschreibung vorhanden."}</span>
                </div>)}
              </div>;
            })}
            {category.singles.map((permission) => {
              const checked = roleGrants[mobileSelectedRoleId]?.has(permission.key) ?? false;
              return <div key={`mobile-single-${permission.key}`} className="flex items-center justify-between border-b border-border/40 bg-card px-4 py-3 last:border-b-0">
                <div className="pr-3">
                  <span className="block text-sm font-medium text-foreground">{permission.label}</span>
                  <span className="block text-xs text-muted-foreground">{permission.description ?? "Keine Beschreibung vorhanden."}</span>
                </div>
                <Checkbox checked={checked} onCheckedChange={(state) => void togglePermission(mobileSelectedRoleId, permission.key, state === true)} />
              </div>;
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>)}
    </div>

    <div className="hidden md:block">
      <div className="overflow-x-auto rounded-lg border border-border">
        <DndSortableProvider onDragEnd={async ({ active, over }) => { if (!over || active.id === over.id) return; const oldIndex = roleOrder.indexOf(String(active.id)); const newIndex = roleOrder.indexOf(String(over.id)); const next = arrayMove(roleOrder, oldIndex, newIndex); setRoleOrder(next); await fetch("/api/permissions/roles/order", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roleIds: next }) }); }}>
          <table className="w-full border-collapse">
            <thead>
              <tr className="sticky top-0 z-10">
                <th className="min-w-[300px] border-b border-border bg-card px-4 py-3 text-left text-sm font-semibold text-foreground">Berechtigung</th>
                <th className="p-0" colSpan={orderedRoles.length}>
                  <SortableContext items={roleOrder} strategy={horizontalListSortingStrategy}>
                    <div className="flex">
                      {orderedRoles.map((role) => <SortableItem key={role.id} id={role.id}>{({ attributes, listeners, setNodeRef, transform, transition }) => <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="w-20 border-b border-l border-border/40 bg-card px-2 py-3 text-center text-sm font-medium text-foreground"><div className="space-y-1"><div className="truncate">{role.name}</div><div className="flex items-center justify-center gap-1"><button type="button" className="rounded p-1 hover:bg-muted" onClick={() => { setRoleName(role.name); setEditRole(role); }}><EditIcon className="size-4" /></button><button type="button" className="cursor-grab rounded p-1 hover:bg-muted" {...attributes} {...listeners}><GripVerticalIcon className="size-4" /></button></div></div></div>}</SortableItem>)}
                    </div>
                  </SortableContext>
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => {
                const forcedOpen = hasSearch;
                const isOpen = forcedOpen || !(collapsedCategories[category.categoryKey] ?? true);
                return <Collapsible key={category.categoryKey} open={isOpen} onOpenChange={(open) => !forcedOpen && setCollapsedCategories((s) => ({ ...s, [category.categoryKey]: !open }))} asChild><>
                  <tr className="bg-muted"><td colSpan={orderedRoles.length + 1} className="border-b border-border px-4 py-2"><CollapsibleTrigger className="flex min-h-11 w-full items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{category.categoryLabel}</span>{isOpen ? <ChevronUpIcon className="size-4 text-muted-foreground" /> : <ChevronDownIcon className="size-4 text-muted-foreground" />}</CollapsibleTrigger></td></tr>
                  <CollapsibleContent asChild><>
                    {category.groups.map((group) => {
                      const groupOpen = openGroups[group.id] ?? hasSearch;
                      return <Fragment key={group.id}>
                        <tr className="bg-muted/40 transition-colors hover:bg-muted/60">
                          <td className="border-b border-border/40 px-4 py-2.5"><button type="button" className="flex w-full items-start justify-between text-left" onClick={() => setOpenGroups((s) => ({ ...s, [group.id]: !groupOpen }))}><span><span className="text-sm font-medium text-foreground">{group.label}</span><span className="block text-xs text-muted-foreground">{group.description}</span></span>{groupOpen ? <ChevronUpIcon className="mt-0.5 size-4 text-muted-foreground" /> : <ChevronDownIcon className="mt-0.5 size-4 text-muted-foreground" />}</button></td>
                          {orderedRoles.map((role) => { const granted = group.keys.filter((key) => roleGrants[role.id]?.has(key)).length; const all = granted === group.keys.length; const some = granted > 0 && !all; return <td key={`${group.id}-${role.id}`} className="w-20 border-b border-l border-border/40 px-2 py-2.5 text-center"><Checkbox checked={all ? true : some ? "indeterminate" : false} onCheckedChange={(state) => { const grant = state === true; void Promise.all(group.keys.map((permissionKey) => togglePermission(role.id, permissionKey, grant))); }} /></td>; })}
                        </tr>
                        {groupOpen && group.members.map((permission, index) => <tr key={permission.key} className={index % 2 === 0 ? "bg-card transition-colors hover:bg-muted/10" : "bg-muted/20 transition-colors hover:bg-muted/30"}><td className="border-b border-border/40 px-4 py-2.5 pl-8"><span className="block text-sm font-medium text-foreground">{permission.label}</span><span className="mt-0.5 block text-xs text-muted-foreground">{permission.description ?? "Keine Beschreibung vorhanden."}</span></td>{orderedRoles.map((role) => <td key={`${permission.key}-${role.id}`} className="w-20 border-b border-l border-border/40 px-2 py-2.5 text-center"><Checkbox disabled checked={roleGrants[role.id]?.has(permission.key) ?? false} /></td>)}</tr>)}
                      </Fragment>;
                    })}
                    {category.singles.map((permission, idx) => <tr key={permission.key} className={idx % 2 === 0 ? "bg-card transition-colors hover:bg-muted/10" : "bg-muted/20 transition-colors hover:bg-muted/30"}><td className="border-b border-border/40 px-4 py-2.5"><span className="block text-sm font-medium text-foreground">{permission.label}</span><span className="mt-0.5 block text-xs text-muted-foreground">{permission.description ?? "Keine Beschreibung vorhanden."}</span></td>{orderedRoles.map((role) => <td key={role.id} className="w-20 border-b border-l border-border/40 px-2 py-2.5 text-center"><Checkbox checked={roleGrants[role.id]?.has(permission.key) ?? false} onCheckedChange={(checked) => void togglePermission(role.id, permission.key, checked === true)} /></td>)}</tr>)}
                  </></CollapsibleContent>
                </></Collapsible>;
              })}
            </tbody>
          </table>
        </DndSortableProvider>
      </div>
    </div>

    <ModalFormDialog open={createOpen} onOpenChange={setCreateOpen} title="Neue Rolle" description="Lege eine neue Rolle an." onSave={async () => { const response = await fetch("/api/permissions/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: roleName }) }); if (!response.ok) { toast.error("Rolle konnte nicht erstellt werden", { duration: 5000 }); return; } const data = await response.json() as { role: PermissionWorkbenchRole }; setRoles((r) => [...r, data.role]); setRoleOrder((o) => [...o, data.role.id]); setCreateOpen(false); toast.success("Rolle erstellt", { duration: 3000 }); }}><Input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="Rollenname" /></ModalFormDialog>

    <ModalFormDialog open={Boolean(editRole)} onOpenChange={(open) => { if (!open) setEditRole(null); }} title="Rolle bearbeiten" description="Passe den Rollennamen an." onSave={async () => { if (!editRole) return; const response = await fetch(`/api/permissions/roles/${editRole.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: roleName }) }); if (!response.ok) { toast.error("Rolle konnte nicht aktualisiert werden", { duration: 5000 }); return; } setRoles((curr) => curr.map((r) => r.id === editRole.id ? { ...r, name: roleName } : r)); setEditRole(null); toast.success("Rolle aktualisiert", { duration: 3000 }); }}><Input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="Rollenname" /></ModalFormDialog>
  </div>;
}

export default PermissionWorkbenchClient;
