"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  ChevronDownIcon,
  EditIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from "@/components/ui/action-icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { UserAvatar } from "@/components/user-avatar";
import { getRolePreferenceWeightLabel } from "@/lib/onboarding/role-preference-utils";
import type {
  AssignmentCharacter,
  AssignmentData,
  AssignmentDepartment,
  AssignmentPerson,
} from "@/lib/departments/assignments";
import type { RolesScenesData } from "@/lib/produktionen/roles-scenes";
import { WISH_LEVELS } from "@/lib/wishes/levels";
import { canEditWishArea } from "@/lib/wishes/permissions";
import type {
  WishlistArea,
  WishlistData,
  WishlistPerson,
  WishlistWish,
} from "@/lib/wishes/wishlist";
import { ActionDropdownMenu } from "@/components/ui/action-dropdown-menu";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

import {
  assignDepartmentMemberAction,
  removeDepartmentMemberAction,
  setCharacterCastingAction,
} from "../actions/assignments";
import { DepartmentSettingsButton } from "../../meine-gewerke/department-settings-panel";
import { RolePanel as RoleEditPanel } from "../stueck/panels";
import { WishPanel } from "./wish-panel";
import { downloadWishlistPdf } from "./wishlist-pdf";

type View = "department" | "roles";
type Filter = "all" | "unassigned" | "requests";
type DepartmentRole = "lead" | "deputy" | "member" | "guest";

const DEPARTMENT_ROLES: DepartmentRole[] = ["lead", "deputy", "member", "guest"];

function isDepartmentRole(value: string): value is DepartmentRole {
  return DEPARTMENT_ROLES.some((role) => role === value);
}

const ROLE_LABELS: Record<DepartmentRole, string> = {
  lead: "Leitung",
  deputy: "Vertretung",
  member: "Mitglied",
  guest: "Gast",
};

const SIZE_RANK: Record<string, number> = {
  acting_lead: 4,
  acting_medium: 3,
  acting_scout: 2,
  acting_statist: 1,
};

type Props = {
  data: AssignmentData;
  /** Rollen/Szenen für den Rollen-Dialog aus „Stück“ – nur für Regie/Board geladen. */
  rolesData: RolesScenesData | null;
  manageAll: boolean;
  leadDepartmentIds: string[];
  /** Wunschliste der Produktion (Ansicht „Wünsche“). */
  wishlist: WishlistData;
};

/** Höchster Wunsch-Wert einer Person für ein Gewerk (0 = kein Wunsch). */
function wishWeight(person: AssignmentPerson, department: AssignmentDepartment) {
  return person.wishes
    .filter((wish) => wish.domain === "crew" && department.preferenceCodes.includes(wish.code))
    .reduce((max, wish) => Math.max(max, wish.weight), 0);
}

function membershipOf(person: AssignmentPerson, departmentId: string) {
  return person.memberships.find((entry) => entry.departmentId === departmentId);
}

export function AssignmentBoard({
  data,
  rolesData,
  manageAll,
  leadDepartmentIds,
  wishlist,
}: Props) {
  const router = useRouter();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [pending, startTransition] = React.useTransition();
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [view, setView] = React.useState<View>("department");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [personId, setPersonId] = React.useState<string | null>(null);
  const [characterId, setCharacterId] = React.useState<string | null>(null);
  // Rollen-Dialog aus „Stück“: `new` = neue Rolle, sonst ID der bearbeiteten Rolle.
  const [editingRole, setEditingRole] = React.useState<string | null>(null);

  const leadSet = React.useMemo(() => new Set(leadDepartmentIds), [leadDepartmentIds]);
  const canManage = React.useCallback(
    (departmentId: string) => manageAll || leadSet.has(departmentId),
    [manageAll, leadSet],
  );
  const canEditArea = React.useCallback(
    (area: WishlistArea) => canEditWishArea(area, { manageAll, leadDepartmentIds }),
    [manageAll, leadDepartmentIds],
  );
  const departments = data.departments;
  const wishPeople = React.useMemo(
    () => new Map(wishlist.people.map((person) => [person.id, person])),
    [wishlist.people],
  );

  const run = React.useCallback(
    (key: string, action: () => Promise<{ ok: boolean; error?: string; message?: string }>) => {
      setBusyKey(key);
      startTransition(async () => {
        const result = await action();
        if (!result.ok)
          toast.error("Speichern fehlgeschlagen", {
            description: result.error ?? "Bitte versuche es noch einmal.",
            duration: 5000,
          });
        else {
          toast.success("Gespeichert", { duration: 3000 });
          router.refresh();
        }
        setBusyKey(null);
      });
    },
    [router],
  );

  const assign = (
    person: AssignmentPerson,
    department: AssignmentDepartment,
    role: DepartmentRole = "member",
  ) =>
    run(`${person.id}:${department.id}`, () =>
      assignDepartmentMemberAction({ departmentId: department.id, userId: person.id, role }),
    );
  const setCasting = (
    person: AssignmentPerson,
    character: AssignmentCharacter,
    type: "primary" | "alternate" | null,
  ) =>
    run(`${person.id}:${character.id}`, () =>
      setCharacterCastingAction({ characterId: character.id, userId: person.id, type }),
    );
  const remove = (person: AssignmentPerson, department: AssignmentDepartment) =>
    run(`${person.id}:${department.id}`, () =>
      removeDepartmentMemberAction({ departmentId: department.id, userId: person.id }),
    );

  const requestCount = data.people.filter((person) =>
    person.memberships.some(
      (entry) => entry.status === "requested" && canManage(entry.departmentId),
    ),
  ).length;
  const unassignedCount = data.people.filter(isUnassigned).length;
  const include = (person: AssignmentPerson) => filter !== "unassigned" || isUnassigned(person);

  const selectedPerson = data.people.find((person) => person.id === personId) ?? null;
  const selectedWishPerson = selectedPerson ? (wishPeople.get(selectedPerson.id) ?? null) : null;
  const selectedCharacter = data.characters.find((entry) => entry.id === characterId) ?? null;

  const exportPdf = async (layout: "list" | "matrix") => {
    try {
      const ids = new Set(data.people.filter(include).map((person) => person.id));
      await downloadWishlistPdf(
        wishlist,
        wishlist.people.filter((person) => ids.has(person.id)),
        layout,
      );
    } catch (error) {
      toast.error("PDF konnte nicht erstellt werden", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const menuItems = [
    { label: "PDF: Liste je Bereich", onSelect: () => void exportPdf("list") },
    { label: "PDF: Matrix Person × Bereich", onSelect: () => void exportPdf("matrix") },
    ...(rolesData ? [{ label: "Neue Rolle", onSelect: () => setEditingRole("new") }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {manageAll ? (
          <SegmentedControl
            aria-label="Ansicht"
            size="md"
            fullWidth
            className="sm:w-auto"
            value={view}
            onValueChange={setView}
            options={[
              { value: "department", label: "Gewerke" },
              { value: "roles", label: "Rollen" },
            ]}
          />
        ) : null}
        <SegmentedControl
          aria-label="Filter"
          size="md"
          fullWidth
          className="sm:w-auto"
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: "all", label: "Alle" },
            { value: "unassigned", label: `Ohne Zuteilung ${unassignedCount}` },
            ...(view === "department"
              ? [{ value: "requests" as const, label: `Anfragen ${requestCount}` }]
              : []),
          ]}
        />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <PersonSearch people={data.people} onPick={setPersonId} />
          <ActionDropdownMenu items={menuItems} label="Weitere Aktionen" className="h-10 w-10" />
        </div>
      </div>

      <WishSummary wishlist={wishlist} onOpen={setPersonId} />

      {view === "department" ? (
        <DepartmentView
          data={data}
          wishlist={wishlist}
          isDesktop={isDesktop}
          filter={filter}
          include={include}
          canManage={canManage}
          manageAll={manageAll}
          busyKey={busyKey}
          onAssign={assign}
          onRemove={remove}
          onOpenPerson={setPersonId}
        />
      ) : (
        <RoleSizesView
          data={data}
          wishlist={wishlist}
          isDesktop={isDesktop}
          include={include}
          onOpenPerson={setPersonId}
          onOpenRole={setCharacterId}
        />
      )}

      <BottomSheet
        open={Boolean(selectedPerson)}
        onOpenChange={(open) => !open && setPersonId(null)}
        title={selectedPerson?.name ?? ""}
        description={manageAll ? "Gewerke, Rollen und Wünsche" : "Gewerke und Wünsche"}
      >
        {selectedPerson ? (
          <PersonPanel
            key={selectedPerson.id}
            person={selectedPerson}
            wishPerson={selectedWishPerson}
            departments={departments}
            canManage={canManage}
            characters={manageAll ? data.characters : []}
            manageAll={manageAll}
            busyKey={busyKey}
            pending={pending}
            onAssign={assign}
            onRemove={remove}
            onCast={setCasting}
          >
            {selectedWishPerson ? (
              <WishPanel
                showId={wishlist.showId}
                person={selectedWishPerson}
                areas={wishlist.areas}
                canEdit={canEditArea}
                onSaved={() => router.refresh()}
              />
            ) : null}
          </PersonPanel>
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={Boolean(selectedCharacter)}
        onOpenChange={(open) => !open && setCharacterId(null)}
        title={selectedCharacter?.name ?? ""}
        description="Rolle besetzen"
      >
        {selectedCharacter ? (
          <RolePanel
            character={selectedCharacter}
            people={data.people}
            busyKey={busyKey}
            onSet={(person, type) => setCasting(person, selectedCharacter, type)}
            onEdit={rolesData ? () => setEditingRole(selectedCharacter.id) : undefined}
          />
        ) : null}
      </BottomSheet>

      {rolesData && editingRole ? (
        <RoleEditPanel
          // Bis die neue Rolle nach dem Anlegen nachgeladen ist, bleibt das Formular stehen.
          key={rolesData.roles.some((role) => role.id === editingRole) ? editingRole : "new"}
          open
          role={rolesData.roles.find((role) => role.id === editingRole) ?? null}
          data={rolesData}
          onClose={() => setEditingRole(null)}
          onCreated={(id) => {
            setEditingRole(id);
            setCharacterId(id);
          }}
        />
      ) : null}
    </div>
  );
}

function isUnassigned(person: AssignmentPerson) {
  return (
    person.castings.length === 0 && !person.memberships.some((entry) => entry.status === "active")
  );
}

/** Namenssuche: öffnet die Person direkt, statt eine lange Personenliste zu zeigen. */
function PersonSearch({
  people,
  onPick,
}: {
  people: AssignmentPerson[];
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? people.filter((person) => person.name.toLowerCase().includes(needle)).slice(0, 8)
    : [];
  return (
    <div className="relative min-w-0 flex-1">
      <SearchField value={query} onChange={setQuery} label="Person öffnen" />
      {matches.length ? (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-md">
          {matches.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onPick(person.id);
                  setQuery("");
                }}
              >
                <UserAvatar
                  userId={person.id}
                  name={person.name}
                  email={person.email}
                  avatarSource={person.avatarSource}
                  avatarUpdatedAt={person.avatarUpdatedAt}
                  size={28}
                />
                {person.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function WishSummary({
  wishlist,
  onOpen,
}: {
  wishlist: WishlistData;
  onOpen: (id: string) => void;
}) {
  const withWishes = wishlist.people.filter((person) => person.wishes.length > 0).length;
  const { assigned, fulfilled, missedIds } = wishlist.fulfillment;
  const missed = wishlist.people.filter((person) => missedIds.includes(person.id));
  return (
    <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm">
      <p>
        {withWishes} von {wishlist.people.length} mit Wünschen
        {assigned > 0 ? ` · ${fulfilled} von ${assigned} Zugeteilten mit Top-Wunsch` : ""}
      </p>
      {missed.length ? (
        <details className="mt-1 text-xs text-muted-foreground">
          <summary className="cursor-pointer">Ohne Top-Wunsch ({missed.length})</summary>
          <p className="mt-1">
            {missed.map((person, index) => (
              <React.Fragment key={person.id}>
                {index > 0 ? ", " : ""}
                <button
                  type="button"
                  className="underline-offset-2 hover:underline"
                  onClick={() => onOpen(person.id)}
                >
                  {person.name}
                </button>
              </React.Fragment>
            ))}
          </p>
        </details>
      ) : null}
    </div>
  );
}

/** Aufklappbare Karte: Desktop offen, mobil zu – Antippen überschreibt beides. */
function FoldCard({
  title,
  color,
  summary,
  defaultOpen,
  children,
}: {
  title: string;
  color?: string | null;
  summary: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [override, setOverride] = React.useState<boolean | null>(null);
  const open = override ?? defaultOpen;
  return (
    <section
      className="min-w-0 rounded-lg border border-border bg-card"
      style={color ? { borderTopColor: color, borderTopWidth: 3 } : undefined}
      aria-label={title}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOverride(!open)}
        className="flex min-h-12 w-full items-center justify-between gap-2 px-4 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="min-w-0">
          <span className="block truncate text-base font-semibold">{title}</span>
          <span className="block text-xs text-muted-foreground">{summary}</span>
        </span>
        <ChevronDownIcon
          className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? <div className="space-y-3 px-4 pb-4">{children}</div> : null}
    </section>
  );
}

type Wisher = { person: AssignmentPerson; wish: WishlistWish };

/** Wünsche gruppiert nach Stufe, je Person mit Aktion (z. B. „Zuweisen“). */
function WishGroups({
  wishers,
  onOpen,
  action,
}: {
  wishers: Wisher[];
  onOpen: (id: string) => void;
  action?: (entry: Wisher) => React.ReactNode;
}) {
  return (
    <>
      {WISH_LEVELS.map(({ level, label }) => {
        const atLevel = wishers.filter((entry) => entry.wish.level === level);
        if (!atLevel.length) return null;
        return (
          <Group key={level} title={`${label} (${atLevel.length})`}>
            {atLevel.map((entry) => (
              <PersonLine
                key={entry.person.id}
                person={entry.person}
                onOpen={onOpen}
                hint={entry.wish.enteredBy ? `nachgetragen von ${entry.wish.enteredBy}` : undefined}
              >
                {action?.(entry)}
              </PersonLine>
            ))}
          </Group>
        );
      })}
    </>
  );
}

/** Kompakte Namensliste für lange Teams und Interessierte. */
function PersonChips({
  people,
  onOpen,
  hint,
  tone,
}: {
  people: AssignmentPerson[];
  onOpen: (id: string) => void;
  hint?: (person: AssignmentPerson) => string | null;
  tone?: (person: AssignmentPerson) => "success" | null;
}) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {people.map((person) => {
        const extra = hint?.(person);
        return (
          <li key={person.id} className="max-w-full">
            <button
              type="button"
              onClick={() => onOpen(person.id)}
              className={cn(
                "inline-flex min-h-9 max-w-full items-center gap-1 rounded-full border px-3 py-1 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tone?.(person) === "success"
                  ? "border-success/40 bg-success/10"
                  : "border-border bg-background",
              )}
            >
              <span className="truncate">{person.name}</span>
              {extra ? (
                <span className="shrink-0 text-xs text-muted-foreground">· {extra}</span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function SearchField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <SearchIcon
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
        className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
      />
    </label>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-12 text-center">
      <p className="text-muted-foreground">{children}</p>
    </div>
  );
}

function DepartmentDot({ color }: { color: string | null }) {
  return (
    <span
      aria-hidden
      className="h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: color ?? "var(--muted-foreground)" }}
    />
  );
}

function PersonPanel({
  person,
  departments,
  characters,
  canManage,
  manageAll,
  busyKey,
  pending,
  onAssign,
  onRemove,
  onCast,
  wishPerson,
  children,
}: {
  person: AssignmentPerson;
  wishPerson: WishlistPerson | null;
  children?: React.ReactNode;
  departments: AssignmentDepartment[];
  /** Rollen zum Besetzen – leer, wenn nur Gewerke verwaltet werden dürfen. */
  characters: AssignmentCharacter[];
  canManage: (departmentId: string) => boolean;
  manageAll: boolean;
  busyKey: string | null;
  pending: boolean;
  onAssign: (
    person: AssignmentPerson,
    department: AssignmentDepartment,
    role?: DepartmentRole,
  ) => void;
  onRemove: (person: AssignmentPerson, department: AssignmentDepartment) => void;
  onCast: (
    person: AssignmentPerson,
    character: AssignmentCharacter,
    type: "primary" | "alternate" | null,
  ) => void;
}) {
  const sorted = [...departments].sort((a, b) => {
    const rank = (department: AssignmentDepartment) => {
      const status = membershipOf(person, department.id)?.status;
      if (status === "requested") return 0;
      if (status === "active") return 1;
      return wishWeight(person, department) > 0 ? 2 : 3;
    };
    return rank(a) - rank(b) || a.name.localeCompare(b.name, "de");
  });

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {pending ? "Speichert …" : "Änderungen gelten sofort"}
      </p>
      {wishPerson ? (
        <dl className="space-y-1 text-sm">
          {wishPerson.memberSince ? (
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Dabei seit</dt>
              <dd>{wishPerson.memberSince}</dd>
            </div>
          ) : null}
          {wishPerson.interests.length ? (
            <div className="flex gap-2">
              <dt className="shrink-0 text-muted-foreground">Interessen</dt>
              <dd className="min-w-0 break-words">{wishPerson.interests.join(", ")}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {person.notes ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          <span className="font-medium">Hinweis ans Team: </span>
          {person.notes}
        </p>
      ) : null}

      <ul className="space-y-2" aria-label={`Gewerke für ${person.name}`}>
        {sorted.map((department) => {
          const membership = membershipOf(person, department.id);
          const weight = wishWeight(person, department);
          const editable = canManage(department.id);
          const busy = busyKey === `${person.id}:${department.id}`;
          return (
            <li
              key={department.id}
              className={cn(
                "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2.5",
                membership?.status === "active"
                  ? "border-success/40 bg-success/5"
                  : membership?.status === "requested"
                    ? "border-warning/50 bg-warning/5"
                    : "border-border/70",
              )}
            >
              <DepartmentDot color={department.color} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{department.name}</p>
                <p className="text-xs text-muted-foreground">
                  {membership?.status === "requested"
                    ? "Anfrage wartet auf Entscheidung"
                    : weight > 0
                      ? `Wunsch · ${getRolePreferenceWeightLabel(weight)}`
                      : membership?.status === "active"
                        ? ROLE_LABELS[membership.role]
                        : "Kein Wunsch"}
                </p>
              </div>
              {editable ? (
                <div className="flex items-center gap-2">
                  {membership?.status === "active" ? (
                    <>
                      <select
                        aria-label={`Funktion in ${department.name}`}
                        value={membership.role}
                        disabled={busy || (membership.role === "lead" && !manageAll)}
                        onChange={(event) => {
                          const role = event.target.value;
                          if (isDepartmentRole(role)) onAssign(person, department, role);
                        }}
                        className="h-10 rounded-lg border border-border bg-background px-2 text-sm"
                      >
                        {DEPARTMENT_ROLES.filter((role) => manageAll || role !== "lead").map(
                          (role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ),
                        )}
                      </select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10"
                        disabled={busy}
                        aria-label={`${person.name} aus ${department.name} entfernen`}
                        onClick={() => onRemove(person, department)}
                      >
                        <XIcon />
                      </Button>
                    </>
                  ) : membership?.status === "requested" ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        className="h-10"
                        disabled={busy}
                        onClick={() => onAssign(person, department)}
                      >
                        Annehmen
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-10"
                        disabled={busy}
                        onClick={() => onRemove(person, department)}
                      >
                        Ablehnen
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant={weight > 0 ? "primary" : "outline"}
                      className="h-10"
                      disabled={busy}
                      onClick={() => onAssign(person, department)}
                    >
                      Zuweisen
                    </Button>
                  )}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {membership?.status === "active" ? "" : "Entscheidet die Leitung"}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {characters.length ? (
        <PersonRoles person={person} characters={characters} busyKey={busyKey} onCast={onCast} />
      ) : null}
      {children}
    </div>
  );
}

/** Rollen einer Person besetzen: besetzte und zur Rollengröße passende zuerst. */
function PersonRoles({
  person,
  characters,
  busyKey,
  onCast,
}: {
  person: AssignmentPerson;
  characters: AssignmentCharacter[];
  busyKey: string | null;
  onCast: (
    person: AssignmentPerson,
    character: AssignmentCharacter,
    type: "primary" | "alternate" | null,
  ) => void;
}) {
  const [showAll, setShowAll] = React.useState(false);
  const actingCodes = new Set(
    person.wishes.filter((wish) => wish.domain === "acting").map((wish) => wish.code),
  );
  const castOf = (character: AssignmentCharacter) =>
    person.castings.find((entry) => entry.characterId === character.id);
  const rank = (character: AssignmentCharacter) =>
    castOf(character) ? 0 : character.sizeCode && actingCodes.has(character.sizeCode) ? 1 : 2;
  const sorted = [...characters].sort((a, b) => rank(a) - rank(b));
  const relevant = sorted.filter((character) => rank(character) < 2);
  const visible = showAll || relevant.length === 0 ? sorted : relevant;

  return (
    <section className="space-y-2 border-t border-border/60 pt-4" aria-label="Rollen">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rollen</h3>
      <ul className="space-y-2">
        {visible.map((character) => {
          const current = castOf(character);
          const busy = busyKey === `${person.id}:${character.id}`;
          return (
            <li
              key={character.id}
              className={cn(
                "rounded-lg border px-3 py-2.5",
                current ? "border-success/40 bg-success/5" : "border-border/70",
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: character.color ?? "var(--muted-foreground)" }}
                />
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{character.name}</p>
                {character.sizeLabel ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {rank(character) === 1 ? "Passt · " : ""}
                    {character.sizeLabel}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 flex gap-2">
                {(["primary", "alternate"] as const).map((type) => (
                  <Button
                    key={type}
                    type="button"
                    size="sm"
                    className="h-10 flex-1"
                    variant={
                      (current ? castKind(current.type) : null) === type ? "primary" : "outline"
                    }
                    aria-pressed={(current ? castKind(current.type) : null) === type}
                    aria-label={`${castLabel(type)} ${character.name}`}
                    disabled={busy}
                    onClick={() =>
                      onCast(
                        person,
                        character,
                        (current ? castKind(current.type) : null) === type ? null : type,
                      )
                    }
                  >
                    {castLabel(type)}
                  </Button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      {visible.length < sorted.length ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10 w-full"
          onClick={() => setShowAll(true)}
        >
          Alle Rollen anzeigen ({sorted.length})
        </Button>
      ) : null}
    </section>
  );
}

function wishersFor(
  data: AssignmentData,
  wishlist: WishlistData,
  match: (area: WishlistArea) => boolean,
): Wisher[] {
  const byId = new Map(data.people.map((person) => [person.id, person]));
  const result: Wisher[] = [];
  for (const wishPerson of wishlist.people) {
    const person = byId.get(wishPerson.id);
    if (!person) continue;
    const best = wishPerson.wishes
      .filter((wish) => {
        const area = wishlist.areas.find((entry) => entry.code === wish.areaCode);
        return area ? match(area) : false;
      })
      .sort((a, b) => b.weight - a.weight)[0];
    if (best) result.push({ person, wish: best });
  }
  return result.sort(
    (a, b) => b.wish.weight - a.wish.weight || a.person.name.localeCompare(b.person.name, "de"),
  );
}

function DepartmentView({
  data,
  wishlist,
  isDesktop,
  filter,
  include,
  canManage,
  manageAll,
  busyKey,
  onAssign,
  onRemove,
  onOpenPerson,
}: {
  data: AssignmentData;
  wishlist: WishlistData;
  isDesktop: boolean;
  filter: Filter;
  include: (person: AssignmentPerson) => boolean;
  canManage: (departmentId: string) => boolean;
  manageAll: boolean;
  busyKey: string | null;
  onAssign: (
    person: AssignmentPerson,
    department: AssignmentDepartment,
    role?: DepartmentRole,
  ) => void;
  onRemove: (person: AssignmentPerson, department: AssignmentDepartment) => void;
  onOpenPerson: (id: string) => void;
}) {
  const visible = data.departments.filter((department) => canManage(department.id));
  const unmapped = wishlist.areas.filter(
    (area) => area.domain === "crew" && area.departmentIds.length === 0,
  );
  if (visible.length === 0 && !manageAll) return <EmptyHint>Keine Gewerke vorhanden.</EmptyHint>;

  const cards = visible
    .map((department) => {
      const members = data.people.filter(
        (person) => membershipOf(person, department.id)?.status === "active",
      );
      const requests = data.people.filter(
        (person) => membershipOf(person, department.id)?.status === "requested",
      );
      const wishers = wishersFor(data, wishlist, (area) =>
        area.departmentIds.includes(department.id),
      ).filter((entry) => !membershipOf(entry.person, department.id) && include(entry.person));
      return { department, members, requests, wishers };
    })
    .filter((card) => filter !== "requests" || card.requests.length > 0);

  return (
    <div className="space-y-4">
      {cards.length === 0 ? (
        <EmptyHint>
          {filter === "requests" ? "Keine offenen Anfragen." : "Keine Gewerke vorhanden."}
        </EmptyHint>
      ) : null}
      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {cards.map(({ department, members, requests, wishers }) => (
          <FoldCard
            key={department.id}
            title={department.name}
            color={department.color}
            defaultOpen={isDesktop || requests.length > 0}
            summary={[
              `Team ${members.length}`,
              wishers.length ? plural(wishers.length, "Wunsch offen", "Wünsche offen") : null,
              requests.length ? plural(requests.length, "Anfrage", "Anfragen") : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          >
            {requests.length ? (
              <Group title={`Anfragen (${requests.length})`}>
                {requests.map((person) => (
                  <PersonLine key={person.id} person={person} onOpen={onOpenPerson}>
                    <Button
                      type="button"
                      size="sm"
                      className="h-10"
                      disabled={busyKey === `${person.id}:${department.id}`}
                      onClick={() => onAssign(person, department)}
                    >
                      Annehmen
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-10"
                      disabled={busyKey === `${person.id}:${department.id}`}
                      onClick={() => onRemove(person, department)}
                    >
                      Ablehnen
                    </Button>
                  </PersonLine>
                ))}
              </Group>
            ) : null}

            {wishers.length ? (
              <WishGroups
                wishers={wishers}
                onOpen={onOpenPerson}
                action={({ person }) => (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-10"
                    disabled={busyKey === `${person.id}:${department.id}`}
                    onClick={() => onAssign(person, department)}
                  >
                    Zuweisen
                  </Button>
                )}
              />
            ) : (
              <p className="text-xs text-muted-foreground">Keine offenen Wünsche.</p>
            )}

            <div className="space-y-1.5">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Team ({members.length})
              </h3>
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch niemand zugewiesen.</p>
              ) : (
                <PersonChips
                  people={[...members].sort(
                    (a, b) =>
                      DEPARTMENT_ROLES.indexOf(membershipOf(a, department.id)!.role) -
                        DEPARTMENT_ROLES.indexOf(membershipOf(b, department.id)!.role) ||
                      a.name.localeCompare(b.name, "de"),
                  )}
                  onOpen={onOpenPerson}
                  hint={(person) => {
                    const role = membershipOf(person, department.id)!.role;
                    return role === "member" ? null : ROLE_LABELS[role];
                  }}
                />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1">
                <AddPersonPicker
                  people={data.people.filter(
                    (person) => membershipOf(person, department.id)?.status !== "active",
                  )}
                  label={`Person zu ${department.name} hinzufügen`}
                  onPick={(person) => onAssign(person, department)}
                />
              </div>
              {manageAll ? (
                <DepartmentSettingsButton showId={data.showId} department={department} stayOnPage />
              ) : null}
            </div>
          </FoldCard>
        ))}
      </div>

      {filter !== "requests"
        ? unmapped.map((area) => {
            const wishers = wishersFor(data, wishlist, (entry) => entry.code === area.code).filter(
              (entry) => include(entry.person),
            );
            if (!wishers.length) return null;
            return (
              <FoldCard
                key={area.code}
                title={`${area.title} (kein Gewerk)`}
                defaultOpen={false}
                summary={`${plural(wishers.length, "Wunsch", "Wünsche")} · in dieser Produktion gibt es dafür kein Gewerk`}
              >
                <WishGroups wishers={wishers} onOpen={onOpenPerson} />
              </FoldCard>
            );
          })
        : null}

      {manageAll ? (
        <DepartmentSettingsButton showId={data.showId} variant="tile" stayOnPage />
      ) : null}
    </div>
  );
}

/** Rollen nach Größe: Interessierte nach Stufe und die Rollen dieser Größe mit Besetzung. */
function RoleSizesView({
  data,
  wishlist,
  isDesktop,
  include,
  onOpenPerson,
  onOpenRole,
}: {
  data: AssignmentData;
  wishlist: WishlistData;
  isDesktop: boolean;
  include: (person: AssignmentPerson) => boolean;
  onOpenPerson: (id: string) => void;
  onOpenRole: (id: string) => void;
}) {
  const sizes = wishlist.areas.filter((area) => area.domain === "acting");
  const withoutSize = data.characters.filter(
    (character) => !character.sizeCode || !sizes.some((area) => area.code === character.sizeCode),
  );
  const characterName = new Map(data.characters.map((character) => [character.id, character.name]));

  const roleList = (characters: AssignmentCharacter[]) => (
    <Group title={`Rollen (${characters.length})`}>
      {characters.length === 0 ? (
        <li className="text-sm text-muted-foreground">Keine Rollen dieser Größe.</li>
      ) : (
        characters.map((character) => {
          const cast = data.people.filter((person) =>
            person.castings.some((entry) => entry.characterId === character.id),
          );
          return (
            <li key={character.id}>
              <button
                type="button"
                onClick={() => onOpenRole(character.id)}
                className="flex min-h-11 w-full items-center gap-2 rounded-md px-1 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: character.color ?? "var(--muted-foreground)" }}
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {character.name}
                </span>
                <span
                  className={cn(
                    "min-w-0 shrink truncate text-xs",
                    cast.length ? "text-success" : "text-muted-foreground",
                  )}
                >
                  {cast.length ? cast.map((person) => person.name).join(", ") : "offen"}
                </span>
              </button>
            </li>
          );
        })
      )}
    </Group>
  );

  return (
    <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 2xl:grid-cols-3">
      {sizes.map((area) => {
        const characters = data.characters.filter((character) => character.sizeCode === area.code);
        const castCount = characters.filter((character) =>
          data.people.some((person) =>
            person.castings.some((entry) => entry.characterId === character.id),
          ),
        ).length;
        const wishers = wishersFor(data, wishlist, (entry) => entry.code === area.code).filter(
          (entry) => include(entry.person),
        );
        return (
          <FoldCard
            key={area.code}
            title={area.title}
            defaultOpen={isDesktop}
            summary={[
              plural(wishers.length, "Interessierte:r", "Interessierte"),
              characters.length ? `${characters.length} Rollen, ${castCount} besetzt` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          >
            {roleList(characters)}
            {wishers.length ? (
              WISH_LEVELS.map(({ level, label }) => {
                const atLevel = wishers.filter((entry) => entry.wish.level === level);
                if (!atLevel.length) return null;
                return (
                  <div key={level} className="space-y-1.5">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {label} ({atLevel.length})
                    </h3>
                    <PersonChips
                      people={atLevel.map((entry) => entry.person)}
                      onOpen={onOpenPerson}
                      tone={(person) => (person.castings.length ? "success" : null)}
                      hint={(person) =>
                        person.castings
                          .map((entry) => characterName.get(entry.characterId))
                          .filter(Boolean)
                          .join(", ") || null
                      }
                    />
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-muted-foreground">Niemand wünscht sich diese Größe.</p>
            )}
          </FoldCard>
        );
      })}
      {withoutSize.length ? (
        <FoldCard
          title="Rollen ohne Größe"
          defaultOpen={false}
          summary="Größe im Stück eintragen, damit Wünsche passen"
        >
          {roleList(withoutSize)}
        </FoldCard>
      ) : null}
    </div>
  );
}

/** Aufklappbare Personensuche zum direkten Hinzufügen. */
function AddPersonPicker({
  people,
  label,
  buttonLabel = "Person hinzufügen",
  onPick,
}: {
  people: AssignmentPerson[];
  label: string;
  buttonLabel?: string;
  onPick: (person: AssignmentPerson) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const needle = query.trim().toLowerCase();
  const matches = people.filter((person) => !needle || person.name.toLowerCase().includes(needle));

  if (!open) {
    return (
      <Button type="button" variant="outline" className="h-10 w-full" onClick={() => setOpen(true)}>
        <PlusIcon className="h-4 w-4" aria-hidden />
        {buttonLabel}
      </Button>
    );
  }
  return (
    <div className="space-y-2 rounded-lg bg-muted p-2">
      <SearchField value={query} onChange={setQuery} label={label} />
      <ul className="max-h-56 overflow-y-auto">
        {matches.slice(0, 30).map((person) => (
          <li key={person.id}>
            <button
              type="button"
              className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-background"
              onClick={() => {
                onPick(person);
                setOpen(false);
                setQuery("");
              }}
            >
              <UserAvatar
                userId={person.id}
                name={person.name}
                email={person.email}
                avatarSource={person.avatarSource}
                avatarUpdatedAt={person.avatarUpdatedAt}
                size={28}
              />
              {person.name}
            </button>
          </li>
        ))}
        {matches.length === 0 ? (
          <li className="px-2 py-3 text-sm text-muted-foreground">Keine Treffer.</li>
        ) : null}
      </ul>
      <Button type="button" variant="ghost" className="h-10 w-full" onClick={() => setOpen(false)}>
        Abbrechen
      </Button>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}

function PersonLine({
  person,
  hint,
  onOpen,
  children,
}: {
  person: AssignmentPerson;
  hint?: string;
  onOpen: (id: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onOpen(person.id)}
        className="flex min-h-10 min-w-[10rem] flex-1 items-center gap-2 rounded-md text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <UserAvatar
          userId={person.id}
          name={person.name}
          email={person.email}
          avatarSource={person.avatarSource}
          avatarUpdatedAt={person.avatarUpdatedAt}
          size={32}
        />
        <span className="min-w-0">
          <span className="block truncate text-sm">{person.name}</span>
          {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
        </span>
      </button>
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </li>
  );
}

/** Cover/Cameo werden wie im Stück-Dialog als Zweitbesetzung behandelt. */
function castKind(type: string): "primary" | "alternate" {
  return type === "primary" ? "primary" : "alternate";
}

function castLabel(type: string) {
  return type === "alternate" ? "Zweitbesetzung" : "Hauptbesetzung";
}

function RolePanel({
  character,
  people,
  busyKey,
  onSet,
  onEdit,
}: {
  character: AssignmentCharacter;
  people: AssignmentPerson[];
  busyKey: string | null;
  onSet: (person: AssignmentPerson, type: "primary" | "alternate" | null) => void;
  /** Öffnet den Rollen-Dialog aus „Stück“ (Name, Größe, Farbe, Szenen). */
  onEdit?: () => void;
}) {
  const [query, setQuery] = React.useState("");
  const [showAll, setShowAll] = React.useState(false);

  const scored = people
    .map((person) => {
      const acting = person.wishes.filter((wish) => wish.domain === "acting");
      const exact = acting.find((wish) => wish.code === character.sizeCode);
      const best = acting.reduce((max, wish) => Math.max(max, wish.weight), 0);
      // Passende Rollengröße zuerst, dann allgemeines Schauspiel-Interesse.
      const cast = person.castings.some((entry) => entry.characterId === character.id);
      const score =
        (cast ? 5000 : 0) +
        (exact ? 1000 : 0) +
        (SIZE_RANK[acting[0]?.code ?? ""] ?? 0) * 10 +
        best / 10;
      return { person, acting, exact, score };
    })
    .sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name, "de"));

  const needle = query.trim().toLowerCase();
  const visible = scored.filter((entry) => {
    if (needle) return entry.person.name.toLowerCase().includes(needle);
    return showAll || entry.acting.length > 0;
  });

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        {character.sizeLabel ? (
          <p className="text-xs text-muted-foreground">Rollengröße: {character.sizeLabel}</p>
        ) : null}
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="ml-auto inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-border bg-card px-3 text-sm font-medium hover:bg-muted"
          >
            <EditIcon className="h-3.5 w-3.5" aria-hidden />
            Bearbeiten
          </button>
        ) : null}
      </div>
      {(["primary", "alternate"] as const).map((type) => {
        const cast = people.filter((person) =>
          person.castings.some(
            // Cover/Cameo zählen wie im Stück-Dialog zur Zweitbesetzung.
            (entry) =>
              entry.characterId === character.id &&
              (entry.type === "primary") === (type === "primary"),
          ),
        );
        return (
          <section key={type} className="space-y-1.5" aria-label={castLabel(type)}>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {castLabel(type)} ({cast.length})
            </h3>
            {cast.length ? (
              <ul className="space-y-1">
                {cast.map((person) => (
                  <li
                    key={person.id}
                    className="flex min-h-11 items-center gap-2 rounded-lg border border-success/40 bg-success/5 px-2"
                  >
                    <UserAvatar
                      userId={person.id}
                      name={person.name}
                      email={person.email}
                      avatarSource={person.avatarSource}
                      avatarUpdatedAt={person.avatarUpdatedAt}
                      size={28}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">{person.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10"
                      disabled={busyKey === `${person.id}:${character.id}`}
                      aria-label={`${person.name} entfernen`}
                      onClick={() => onSet(person, null)}
                    >
                      <XIcon />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            <AddPersonPicker
              people={people.filter(
                (person) => !person.castings.some((entry) => entry.characterId === character.id),
              )}
              label="Person suchen"
              buttonLabel={`${castLabel(type)} hinzufügen`}
              onPick={(person) => onSet(person, type)}
            />
          </section>
        );
      })}

      <h3 className="border-t border-border/60 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Vorschläge aus den Wünschen
      </h3>
      <SearchField value={query} onChange={setQuery} label="Person suchen" />
      <ul className="space-y-2" aria-label="Personen für diese Rolle">
        {visible.map(({ person, acting, exact }) => {
          const current = person.castings.find((entry) => entry.characterId === character.id);
          const busy = busyKey === `${person.id}:${character.id}`;
          return (
            <li key={person.id} className="rounded-lg border border-border/70 px-3 py-2.5">
              <div className="flex items-center gap-3">
                <UserAvatar
                  userId={person.id}
                  name={person.name}
                  email={person.email}
                  avatarSource={person.avatarSource}
                  avatarUpdatedAt={person.avatarUpdatedAt}
                  size={32}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{person.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {acting.length
                      ? `${exact ? "Passt · " : ""}${acting[0].title} (${getRolePreferenceWeightLabel(acting[0].weight)})`
                      : "Kein Schauspiel-Wunsch"}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["primary", "alternate"] as const).map((type) => (
                  <Button
                    key={type}
                    type="button"
                    size="sm"
                    className="h-10 flex-1"
                    variant={
                      (current ? castKind(current.type) : null) === type ? "primary" : "outline"
                    }
                    aria-pressed={(current ? castKind(current.type) : null) === type}
                    disabled={busy}
                    onClick={() =>
                      onSet(
                        person,
                        (current ? castKind(current.type) : null) === type ? null : type,
                      )
                    }
                  >
                    {castLabel(type)}
                  </Button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      {!needle && !showAll ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10 w-full"
          onClick={() => setShowAll(true)}
        >
          Alle Personen anzeigen
        </Button>
      ) : null}
      {visible.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">Niemand gefunden.</p>
      ) : null}
    </div>
  );
}
