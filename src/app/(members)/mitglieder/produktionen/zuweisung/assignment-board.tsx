"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { CheckIcon, SearchIcon, XIcon } from "@/components/ui/action-icons";
import { Badge } from "@/components/ui/badge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { getRolePreferenceWeightLabel } from "@/lib/onboarding/role-preference-utils";
import type {
  AssignmentCharacter,
  AssignmentData,
  AssignmentDepartment,
  AssignmentPerson,
} from "@/lib/departments/assignments";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

import {
  assignDepartmentMemberAction,
  removeDepartmentMemberAction,
  setCharacterCastingAction,
} from "../actions/assignments";

type View = "person" | "department" | "roles";
type Filter = "all" | "open" | "requests";
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
  manageAll: boolean;
  leadDepartmentIds: string[];
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

export function AssignmentBoard({ data, manageAll, leadDepartmentIds }: Props) {
  const router = useRouter();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [pending, startTransition] = React.useTransition();
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [view, setView] = React.useState<View>(manageAll ? "person" : "department");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [query, setQuery] = React.useState("");
  const [personId, setPersonId] = React.useState<string | null>(null);
  const [characterId, setCharacterId] = React.useState<string | null>(null);

  const leadSet = React.useMemo(() => new Set(leadDepartmentIds), [leadDepartmentIds]);
  const canManage = React.useCallback(
    (departmentId: string) => manageAll || leadSet.has(departmentId),
    [manageAll, leadSet],
  );
  const departments = data.departments;

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
  const remove = (person: AssignmentPerson, department: AssignmentDepartment) =>
    run(`${person.id}:${department.id}`, () =>
      removeDepartmentMemberAction({ departmentId: department.id, userId: person.id }),
    );

  const requestCount = data.people.filter((person) =>
    person.memberships.some(
      (entry) => entry.status === "requested" && canManage(entry.departmentId),
    ),
  ).length;
  const isOpen = (person: AssignmentPerson) =>
    departments.some(
      (department) =>
        wishWeight(person, department) > 0 &&
        canManage(department.id) &&
        membershipOf(person, department.id)?.status !== "active",
    );
  const openCount = data.people.filter(isOpen).length;

  const people = data.people.filter((person) => {
    if (query && !person.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
    if (filter === "open") return isOpen(person);
    if (filter === "requests") {
      return person.memberships.some(
        (entry) => entry.status === "requested" && canManage(entry.departmentId),
      );
    }
    return true;
  });

  const selectedPerson = data.people.find((person) => person.id === personId) ?? null;
  const selectedCharacter = data.characters.find((entry) => entry.id === characterId) ?? null;

  const viewOptions: { value: View; label: string }[] = [
    { value: "person", label: "Personen" },
    { value: "department", label: "Gewerke" },
    ...(manageAll ? [{ value: "roles" as const, label: "Rollen" }] : []),
  ];

  const personPanel = selectedPerson ? (
    <PersonPanel
      person={selectedPerson}
      departments={departments}
      canManage={canManage}
      manageAll={manageAll}
      busyKey={busyKey}
      pending={pending}
      onAssign={assign}
      onRemove={remove}
    />
  ) : null;
  const rolePanel = selectedCharacter ? (
    <RolePanel
      character={selectedCharacter}
      people={data.people}
      busyKey={busyKey}
      onSet={(person, type) =>
        run(`${person.id}:${selectedCharacter.id}`, () =>
          setCharacterCastingAction({
            characterId: selectedCharacter.id,
            userId: person.id,
            type,
          }),
        )
      }
    />
  ) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl
          aria-label="Ansicht"
          size="md"
          fullWidth
          className="sm:w-auto"
          value={view}
          onValueChange={setView}
          options={viewOptions}
        />
        {view === "person" ? (
          <SegmentedControl
            aria-label="Filter"
            size="md"
            fullWidth
            className="sm:w-auto"
            value={filter}
            onValueChange={setFilter}
            options={[
              { value: "all", label: `Alle ${data.people.length}` },
              { value: "open", label: `Offen ${openCount}` },
              { value: "requests", label: `Anfragen ${requestCount}` },
            ]}
          />
        ) : null}
      </div>

      {view === "person" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_26rem] xl:grid-cols-[minmax(0,1fr)_30rem]">
          <section className="space-y-3" aria-label="Personen">
            <SearchField value={query} onChange={setQuery} label="Person suchen" />
            {people.length === 0 ? (
              <EmptyHint>
                {data.people.length === 0
                  ? "In dieser Produktion gibt es noch keine Mitglieder."
                  : "Keine Person passt zu Suche und Filter."}
              </EmptyHint>
            ) : (
              <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-card">
                {people.map((person) => (
                  <li key={person.id}>
                    <PersonRow
                      person={person}
                      departments={departments}
                      selected={person.id === personId}
                      onSelect={() => setPersonId(person.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
          {isDesktop ? (
            <aside className="hidden lg:block">
              <div className="sticky top-4 max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border border-border/70 bg-card p-4">
                {personPanel ?? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Wähle links eine Person, um Gewerke zuzuweisen.
                  </p>
                )}
              </div>
            </aside>
          ) : (
            <BottomSheet
              open={Boolean(selectedPerson)}
              onOpenChange={(open) => !open && setPersonId(null)}
              title={selectedPerson?.name ?? ""}
              description="Gewerke zuweisen"
            >
              {personPanel}
            </BottomSheet>
          )}
        </div>
      ) : null}

      {view === "department" ? (
        <DepartmentView
          data={data}
          canManage={canManage}
          busyKey={busyKey}
          onAssign={assign}
          onRemove={remove}
          onOpenPerson={(id) => {
            setPersonId(id);
            setView("person");
          }}
        />
      ) : null}

      {view === "roles" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_26rem] xl:grid-cols-[minmax(0,1fr)_30rem]">
          <RolesList
            characters={data.characters}
            people={data.people}
            selectedId={characterId}
            onSelect={setCharacterId}
          />
          {isDesktop ? (
            <aside className="hidden lg:block">
              <div className="sticky top-4 max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border border-border/70 bg-card p-4">
                {rolePanel ?? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    Wähle links eine Rolle, um sie zu besetzen.
                  </p>
                )}
              </div>
            </aside>
          ) : (
            <BottomSheet
              open={Boolean(selectedCharacter)}
              onOpenChange={(open) => !open && setCharacterId(null)}
              title={selectedCharacter?.name ?? ""}
              description="Rolle besetzen"
            >
              {rolePanel}
            </BottomSheet>
          )}
        </div>
      ) : null}
    </div>
  );
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

function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground/80",
        className,
      )}
    >
      {initials}
    </span>
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

function PersonRow({
  person,
  departments,
  selected,
  onSelect,
}: {
  person: AssignmentPerson;
  departments: AssignmentDepartment[];
  selected: boolean;
  onSelect: () => void;
}) {
  const wished = departments
    .map((department) => ({ department, weight: wishWeight(person, department) }))
    .filter((entry) => entry.weight > 0)
    .sort((a, b) => b.weight - a.weight);
  const actingWish = person.wishes.find((wish) => wish.domain === "acting");
  const assigned = person.memberships.filter((entry) => entry.status === "active").length;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex min-h-14 w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        selected && "bg-primary/5",
      )}
    >
      <Avatar initials={person.initials} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{person.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {assigned > 0
              ? `${assigned} ${assigned === 1 ? "Gewerk" : "Gewerke"}`
              : "Nicht zugewiesen"}
          </span>
        </span>
        <span className="mt-1.5 flex flex-wrap gap-1.5">
          {wished.map(({ department }) => {
            const membership = membershipOf(person, department.id);
            const status = membership?.status;
            return (
              <span
                key={department.id}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs",
                  status === "active"
                    ? "border-success/40 bg-success/10 text-success"
                    : status === "requested"
                      ? "border-warning/50 bg-warning/10 text-warning"
                      : "border-dashed border-border text-muted-foreground",
                )}
              >
                <DepartmentDot color={department.color} />
                {department.name}
                {status === "active" ? (
                  <CheckIcon className="h-3 w-3" aria-label="zugewiesen" />
                ) : null}
                {status === "requested" ? " · Anfrage" : null}
              </span>
            );
          })}
          {actingWish ? (
            <span className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
              Schauspiel: {actingWish.title}
            </span>
          ) : null}
          {wished.length === 0 && !actingWish ? (
            <span className="text-xs text-muted-foreground">Keine Wünsche angegeben</span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

function PersonPanel({
  person,
  departments,
  canManage,
  manageAll,
  busyKey,
  pending,
  onAssign,
  onRemove,
}: {
  person: AssignmentPerson;
  departments: AssignmentDepartment[];
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
  const wishLabels = person.wishes.filter((wish) => wish.domain === "crew");

  return (
    <div className="space-y-4">
      <div className="hidden items-center gap-3 lg:flex">
        <Avatar initials={person.initials} className="h-11 w-11 text-sm" />
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{person.name}</h2>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {pending ? "Speichert …" : "Änderungen gelten sofort"}
          </p>
        </div>
      </div>

      {person.notes ? (
        <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
          <span className="font-medium">Hinweis aus dem Onboarding: </span>
          {person.notes}
        </p>
      ) : null}

      {wishLabels.length ? (
        <p className="text-xs text-muted-foreground">
          Wünsche:{" "}
          {wishLabels
            .map((wish) => `${wish.title} (${getRolePreferenceWeightLabel(wish.weight)})`)
            .join(", ")}
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
    </div>
  );
}

function DepartmentView({
  data,
  canManage,
  busyKey,
  onAssign,
  onRemove,
  onOpenPerson,
}: {
  data: AssignmentData;
  canManage: (departmentId: string) => boolean;
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
  if (visible.length === 0) return <EmptyHint>Keine Gewerke vorhanden.</EmptyHint>;

  return (
    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
      {visible.map((department) => {
        const members = data.people.filter(
          (person) => membershipOf(person, department.id)?.status === "active",
        );
        const requests = data.people.filter(
          (person) => membershipOf(person, department.id)?.status === "requested",
        );
        const wishing = data.people
          .filter(
            (person) => !membershipOf(person, department.id) && wishWeight(person, department) > 0,
          )
          .sort((a, b) => wishWeight(b, department) - wishWeight(a, department));

        return (
          <section
            key={department.id}
            className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4"
            style={{ borderTopColor: department.color ?? undefined, borderTopWidth: 3 }}
            aria-label={department.name}
          >
            <header className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">{department.name}</h2>
              <Badge variant="muted">
                {members.length} {members.length === 1 ? "Person" : "Personen"}
              </Badge>
            </header>

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

            <details className="group rounded-lg" open={members.length <= 3}>
              <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span>Team ({members.length})</span>
                <span className="normal-case tracking-normal group-open:hidden">anzeigen</span>
              </summary>
              <ul className="mt-1.5 space-y-1">
                {members.length === 0 ? (
                  <li className="text-sm text-muted-foreground">Noch niemand zugewiesen.</li>
                ) : (
                  members
                    .sort(
                      (a, b) =>
                        DEPARTMENT_ROLES.indexOf(membershipOf(a, department.id)!.role) -
                        DEPARTMENT_ROLES.indexOf(membershipOf(b, department.id)!.role),
                    )
                    .map((person) => (
                      <PersonLine
                        key={person.id}
                        person={person}
                        onOpen={onOpenPerson}
                        hint={ROLE_LABELS[membershipOf(person, department.id)!.role]}
                      />
                    ))
                )}
              </ul>
            </details>

            {wishing.length ? (
              <Group title={`Möchten mitmachen (${wishing.length})`}>
                {wishing.map((person) => (
                  <PersonLine
                    key={person.id}
                    person={person}
                    onOpen={onOpenPerson}
                    hint={getRolePreferenceWeightLabel(wishWeight(person, department))}
                  >
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
                  </PersonLine>
                ))}
              </Group>
            ) : null}
          </section>
        );
      })}
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
        <Avatar initials={person.initials} className="h-8 w-8" />
        <span className="min-w-0">
          <span className="block truncate text-sm">{person.name}</span>
          {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
        </span>
      </button>
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </li>
  );
}

function castLabel(type: string) {
  return type === "alternate" ? "Zweitbesetzung" : "Hauptrolle";
}

function RolesList({
  characters,
  people,
  selectedId,
  onSelect,
}: {
  characters: AssignmentCharacter[];
  people: AssignmentPerson[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (characters.length === 0) {
    return (
      <EmptyHint>
        Für diese Produktion sind noch keine Rollen angelegt. Rollen legst du unter „Besetzung“ an.
      </EmptyHint>
    );
  }
  return (
    <ul
      className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-card"
      aria-label="Rollen"
    >
      {characters.map((character) => {
        const cast = people.flatMap((person) =>
          person.castings
            .filter((entry) => entry.characterId === character.id)
            .map((entry) => ({ person, type: entry.type })),
        );
        return (
          <li key={character.id}>
            <button
              type="button"
              onClick={() => onSelect(character.id)}
              aria-pressed={character.id === selectedId}
              className={cn(
                "flex min-h-14 w-full items-start gap-3 px-3 py-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                character.id === selectedId && "bg-primary/5",
              )}
            >
              <span
                aria-hidden
                className="mt-1 h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: character.color ?? "var(--muted-foreground)" }}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{character.name}</span>
                  {character.sizeLabel ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {character.sizeLabel}
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {cast.length
                    ? cast
                        .map(({ person, type }) => `${person.name} (${castLabel(type)})`)
                        .join(", ")
                    : "Noch nicht besetzt"}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function RolePanel({
  character,
  people,
  busyKey,
  onSet,
}: {
  character: AssignmentCharacter;
  people: AssignmentPerson[];
  busyKey: string | null;
  onSet: (person: AssignmentPerson, type: "primary" | "alternate" | null) => void;
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
      <div className="hidden lg:block">
        <h2 className="text-base font-semibold">{character.name}</h2>
        {character.sizeLabel ? (
          <p className="text-xs text-muted-foreground">Rollengröße: {character.sizeLabel}</p>
        ) : null}
      </div>
      <SearchField value={query} onChange={setQuery} label="Person suchen" />
      <ul className="space-y-2" aria-label="Personen für diese Rolle">
        {visible.map(({ person, acting, exact }) => {
          const current = person.castings.find((entry) => entry.characterId === character.id);
          const busy = busyKey === `${person.id}:${character.id}`;
          return (
            <li key={person.id} className="rounded-lg border border-border/70 px-3 py-2.5">
              <div className="flex items-center gap-3">
                <Avatar initials={person.initials} className="h-8 w-8" />
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
                    variant={current?.type === type ? "primary" : "outline"}
                    aria-pressed={current?.type === type}
                    disabled={busy}
                    onClick={() => onSet(person, current?.type === type ? null : type)}
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
