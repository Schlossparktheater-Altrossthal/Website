"use client";

import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Clock3, Filter, Search } from "lucide-react";

import { MeasurementForm } from "@/components/forms/measurement-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { UserAvatar, type AvatarSource } from "@/components/user-avatar";
import {
  MEASUREMENT_TYPE_LABELS,
  MEASUREMENT_UNIT_LABELS,
  measurementResponseSchema,
  measurementTypeEnum,
  sortMeasurements,
  type MeasurementFormData,
  type MeasurementType,
  type MeasurementUnit,
} from "@/data/measurements";
import { ROLE_BADGE_VARIANTS, ROLE_LABELS, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { formatRelativeWithAbsolute } from "@/lib/datetime";

type MeasurementEntry = {
  id: string;
  type: MeasurementType;
  value: number;
  unit: MeasurementUnit;
  note: string | null;
  updatedAt: string;
};

type MeasurementMember = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  roles: Role[];
  avatarSource: AvatarSource | string | null;
  avatarUpdatedAt: string | null;
  measurements: MeasurementEntry[];
};

type MemberMeasurementsControlCenterProps = {
  members: MeasurementMember[];
};

type DialogState =
  | { mode: "create"; memberId: string; initialType?: MeasurementType }
  | { mode: "edit"; memberId: string; entry: MeasurementEntry };

type MemberStats = {
  total: number;
  captured: number;
  missing: number;
  completion: number;
  missingTypes: MeasurementType[];
  lastUpdated: string | null;
};

type PreparedMember = MeasurementMember & {
  displayName: string;
  stats: MemberStats;
  searchText: string;
  measurementMap: Map<MeasurementType, MeasurementEntry>;
};

type MeasurementRow = {
  type: MeasurementType;
  label: string;
  entryMap: Map<string, MeasurementEntry | null>;
  missingCount: number;
  isComplete: boolean;
};

const TOTAL_TYPES = measurementTypeEnum.options.length;
const NUMBER_FORMATTER = new Intl.NumberFormat("de-DE");
const PERCENT_FORMATTER = new Intl.NumberFormat("de-DE", {
  style: "percent",
  maximumFractionDigits: 0,
});
const ABSOLUTE_DATE_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function MemberMeasurementsControlCenter({
  members,
}: MemberMeasurementsControlCenterProps) {
  const [memberItems, setMemberItems] = useState(() =>
    members.map((member) => ({
      ...member,
      measurements: sortMeasurements(member.measurements),
    })),
  );
  const [memberSearch, setMemberSearch] = useState("");
  const [memberFilter, setMemberFilter] = useState<"all" | "complete" | "missing">("all");
  const [measurementSearch, setMeasurementSearch] = useState("");
  const [measurementFilter, setMeasurementFilter] = useState<"all" | "complete" | "missing">("all");
  const [memberDialogId, setMemberDialogId] = useState<string | null>(null);
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!members.length) {
      setMemberDialogId(null);
    }
  }, [members.length]);

  const preparedMembers = useMemo<PreparedMember[]>(() => {
    return memberItems.map((member) => {
      const displayName = buildDisplayName(member);
      const measurementMap = new Map<MeasurementType, MeasurementEntry>(
        member.measurements.map((entry) => [entry.type, entry]),
      );
      const missingTypes = measurementTypeEnum.options.filter((type) => !measurementMap.has(type));
      const captured = member.measurements.length;
      const lastUpdated = member.measurements.reduce<string | null>((latest, entry) => {
        if (!entry.updatedAt) return latest;
        if (!latest || entry.updatedAt > latest) {
          return entry.updatedAt;
        }
        return latest;
      }, null);
      const stats: MemberStats = {
        total: TOTAL_TYPES,
        captured,
        missing: Math.max(0, TOTAL_TYPES - captured),
        completion: TOTAL_TYPES > 0 ? captured / TOTAL_TYPES : 0,
        missingTypes,
        lastUpdated,
      };
      const searchText = [
        displayName,
        member.roles.join(" "),
        ...member.measurements.map((entry) => `${MEASUREMENT_TYPE_LABELS[entry.type]}`),
      ]
        .join(" ")
        .toLowerCase();

      return { ...member, displayName, stats, searchText, measurementMap };
    });
  }, [memberItems]);

  const normalizedMemberSearch = memberSearch.trim().toLowerCase();
  const normalizedMeasurementSearch = measurementSearch.trim().toLowerCase();

  const filteredMembers = useMemo(() => {
    return preparedMembers.filter((member) => {
      if (memberFilter === "complete" && member.stats.missing > 0) return false;
      if (memberFilter === "missing" && member.stats.missing === 0) return false;
      if (normalizedMemberSearch && !member.searchText.includes(normalizedMemberSearch)) {
        return false;
      }
      return true;
    });
  }, [preparedMembers, memberFilter, normalizedMemberSearch]);

  const sortedMembers = useMemo(() => {
    return [...filteredMembers].sort((a, b) => {
      if (a.stats.missing !== b.stats.missing) {
        return b.stats.missing - a.stats.missing;
      }
      if (a.displayName && b.displayName) {
        return a.displayName.localeCompare(b.displayName, "de-DE");
      }
      return 0;
    });
  }, [filteredMembers]);

  useEffect(() => {
    if (memberDialogId && !sortedMembers.some((member) => member.id === memberDialogId)) {
      setMemberDialogId(null);
    }
  }, [memberDialogId, sortedMembers]);

  useEffect(() => {
    if (dialogState && !preparedMembers.some((member) => member.id === dialogState.memberId)) {
      setDialogState(null);
    }
  }, [dialogState, preparedMembers]);

  const measurementRows = useMemo<MeasurementRow[]>(() => {
    return measurementTypeEnum.options
      .map<MeasurementRow | null>((type) => {
        const label = MEASUREMENT_TYPE_LABELS[type] ?? type;
        if (normalizedMeasurementSearch && !label.toLowerCase().includes(normalizedMeasurementSearch)) {
          return null;
        }
        const entryMap = new Map<string, MeasurementEntry | null>();
        let missingCount = 0;
        for (const member of sortedMembers) {
          const entry = member.measurementMap.get(type) ?? null;
          entryMap.set(member.id, entry);
          if (!entry) {
            missingCount += 1;
          }
        }
        const isComplete = sortedMembers.length > 0 && missingCount === 0;

        if (measurementFilter === "complete" && !isComplete) {
          return null;
        }
        if (measurementFilter === "missing" && missingCount === 0) {
          return null;
        }

        return { type, label, entryMap, missingCount, isComplete };
      })
      .filter((row): row is MeasurementRow => row !== null);
  }, [measurementFilter, normalizedMeasurementSearch, sortedMembers]);

  const columns = useMemo<ColumnDef<MeasurementRow>[]>(() => {
    const base: ColumnDef<MeasurementRow>[] = [
      {
        accessorKey: "label",
        header: "Maß",
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex items-center justify-between gap-2 pr-2 text-sm">
              <span className="font-medium text-foreground">{item.label}</span>
              {item.missingCount > 0 ? (
                <Badge
                  variant="outline"
                  className="border-destructive/50 bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive"
                >
                  {item.missingCount} offen
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-success/40 bg-success/10 px-2 py-0.5 text-[10px] text-success"
                >
                  Vollständig
                </Badge>
              )}
            </div>
          );
        },
        meta: {
          headerClassName: "sticky left-0 z-20 bg-muted/30",
          cellClassName:
            "sticky left-0 z-10 border-r border-border/60 bg-background px-4 py-3 text-sm font-medium text-foreground",
        },
      },
    ];

    sortedMembers.forEach((member) => {
      base.push({
        id: member.id,
        header: () => (
          <button
            type="button"
            onClick={() => setMemberDialogId(member.id)}
            className="flex w-full flex-col items-start gap-1 rounded-md px-1 text-left text-xs text-muted-foreground transition hover:text-foreground"
          >
            <span className="w-full truncate text-sm font-semibold text-foreground">{member.displayName}</span>
            <span className="w-full truncate text-[10px]">
              {member.stats.captured}/{member.stats.total} Maße
              {member.stats.missing > 0 ? ` · ${member.stats.missing} offen` : " · Vollständig"}
            </span>
          </button>
        ),
        cell: ({ row }) => {
          const entry = row.original.entryMap.get(member.id) ?? null;
          const unitLabel = entry ? MEASUREMENT_UNIT_LABELS[entry.unit] ?? entry.unit : undefined;
          const secondaryText = entry?.note?.trim()
            ? entry.note
            : entry?.updatedAt
            ? ABSOLUTE_DATE_FORMATTER.format(new Date(entry.updatedAt))
            : "Keine Notiz";

          return (
            <button
              type="button"
              onClick={() =>
                entry
                  ? setDialogState({ mode: "edit", memberId: member.id, entry })
                  : setDialogState({ mode: "create", memberId: member.id, initialType: row.original.type })
              }
              className={cn(
                "flex h-full w-full flex-col gap-1 rounded-md border border-transparent px-2 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                entry
                  ? "hover:border-primary/40 hover:bg-primary/5"
                  : "border-dashed border-destructive/60 bg-destructive/10 hover:border-destructive/70",
              )}
              title={entry?.note ?? undefined}
            >
              <div className="flex items-baseline gap-1">
                <span className="font-semibold text-foreground">
                  {entry ? formatValue(entry.value) : "—"}
                </span>
                <span className={cn("text-[10px]", entry ? "text-muted-foreground" : "text-destructive")}>
                  {entry ? unitLabel ?? entry.unit : "Fehlt"}
                </span>
              </div>
              <span className="truncate text-[10px] text-muted-foreground/80">{secondaryText}</span>
            </button>
          );
        },
        meta: {
          headerClassName: "min-w-[180px] border-l border-border/60 align-bottom",
          cellClassName: "min-w-[180px] border-l border-border/60 px-2 py-1.5",
        },
      });
    });

    return base;
  }, [sortedMembers, setDialogState, setMemberDialogId]);

  const dialogMember = dialogState
    ? preparedMembers.find((member) => member.id === dialogState.memberId) ?? null
    : null;

  const memberModalMember = memberDialogId
    ? preparedMembers.find((member) => member.id === memberDialogId) ?? null
    : null;

  const handleDialogClose = () => {
    if (saving) return;
    setDialogState(null);
  };

  const handleMemberDialogClose = () => {
    if (saving) return;
    setMemberDialogId(null);
  };

  const handleSubmit = async (memberId: string, data: MeasurementFormData) => {
    setSaving(true);
    try {
      const response = await fetch("/api/measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, userId: memberId }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) {
        const message =
          typeof payload?.error === "string"
            ? payload.error
            : "Speichern der Maße fehlgeschlagen.";
        throw new Error(message);
      }

      const parsed = measurementResponseSchema.parse({
        ...payload,
        note: payload?.note ?? null,
      });

      const saved: MeasurementEntry = {
        id: parsed.id,
        type: parsed.type,
        value: parsed.value,
        unit: parsed.unit,
        note: parsed.note ?? null,
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
      };

      setMemberItems((prev) =>
        prev.map((member) => {
          if (member.id !== memberId) return member;
          const nextMeasurements = sortMeasurements([
            ...member.measurements.filter((entry) => entry.type !== saved.type),
            saved,
          ]);
          return { ...member, measurements: nextMeasurements };
        }),
      );

      setDialogState(null);
    } finally {
      setSaving(false);
    }
  };

  const globalStats = useMemo(() => {
    const totalMembers = memberItems.length;
    const totalMeasurements = memberItems.reduce((sum, member) => sum + member.measurements.length, 0);
    const completedMembers = memberItems.reduce(
      (count, member) => (member.measurements.length === TOTAL_TYPES ? count + 1 : count),
      0,
    );
    const averageCompletion =
      totalMembers === 0
        ? 0
        : memberItems.reduce((sum, member) => sum + member.measurements.length / Math.max(1, TOTAL_TYPES), 0) /
          totalMembers;

    return {
      totalMembers,
      totalMeasurements,
      completedMembers,
      missingMembers: Math.max(0, totalMembers - completedMembers),
      averageCompletion,
    };
  }, [memberItems]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/60 bg-background p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground/70">Anprobe Control Center</p>
            <h2 className="text-lg font-semibold text-foreground">Körpermaße im Überblick</h2>
          </div>
          <Badge className="border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary" variant="outline">
            Live Sync aktiv
          </Badge>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <StatBlock label="Ensemble" value={NUMBER_FORMATTER.format(globalStats.totalMembers)} hint="Mitglieder" />
          <StatBlock
            label="Erfasste Maße"
            value={NUMBER_FORMATTER.format(globalStats.totalMeasurements)}
            hint="Datensätze"
          />
          <StatBlock
            label="Abdeckung"
            value={PERCENT_FORMATTER.format(globalStats.averageCompletion)}
            hint={
              globalStats.missingMembers > 0
                ? `${globalStats.missingMembers} Profile offen`
                : "Vollständig"
            }
          />
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-background p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Mitglieder</p>
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={memberSearch}
                onChange={(event) => setMemberSearch(event.target.value)}
                placeholder="Mitglieder oder Rollen suchen"
                className="h-8 flex-1 border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <FilterButton label="Alle" active={memberFilter === "all"} onClick={() => setMemberFilter("all")} />
              <FilterButton
                label="Vollständig"
                active={memberFilter === "complete"}
                onClick={() => setMemberFilter("complete")}
              />
              <FilterButton
                label="Fehlend"
                active={memberFilter === "missing"}
                onClick={() => setMemberFilter("missing")}
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">Maßarten</p>
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={measurementSearch}
                onChange={(event) => setMeasurementSearch(event.target.value)}
                placeholder="Maßart filtern"
                className="h-8 flex-1 border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <FilterButton label="Alle" active={measurementFilter === "all"} onClick={() => setMeasurementFilter("all")} />
              <FilterButton
                label="Vollständig"
                active={measurementFilter === "complete"}
                onClick={() => setMeasurementFilter("complete")}
              />
              <FilterButton
                label="Fehlend"
                active={measurementFilter === "missing"}
                onClick={() => setMeasurementFilter("missing")}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-background p-2 shadow-sm">
        {sortedMembers.length ? (
          measurementRows.length ? (
            <DataTable columns={columns} data={measurementRows} tableClassName="min-w-[720px] text-xs" />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-sm text-muted-foreground">
              <AlertTriangle className="h-5 w-5" />
              <p>Keine Maße entsprechen den aktuellen Filtern. Passe die Auswahl an.</p>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-sm text-muted-foreground">
            <AlertTriangle className="h-5 w-5" />
            <p>Keine Mitglieder mit Körpermaßen gefunden. Lege neue Profile an oder entferne Filter.</p>
          </div>
        )}
      </div>

      <Dialog open={memberDialogId !== null} onOpenChange={(open) => (!open ? handleMemberDialogClose() : null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader className="sr-only">
            <DialogTitle>
              {memberModalMember ? `Übersicht für ${memberModalMember.displayName}` : "Profilübersicht"}
            </DialogTitle>
          </DialogHeader>
          {memberModalMember ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 items-center gap-4">
                  <UserAvatar
                    userId={memberModalMember.id}
                    firstName={memberModalMember.firstName}
                    lastName={memberModalMember.lastName}
                    name={memberModalMember.name}
                    avatarSource={memberModalMember.avatarSource}
                    avatarUpdatedAt={memberModalMember.avatarUpdatedAt}
                    size={72}
                    className="border-border/70"
                  />
                  <div>
                    <h2 className="font-serif text-2xl text-foreground">{memberModalMember.displayName}</h2>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {memberModalMember.roles.length ? (
                        memberModalMember.roles.map((role) => (
                          <span
                            key={role}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs",
                              ROLE_BADGE_VARIANTS[role] ?? "border border-border/60 bg-muted/40 text-muted-foreground",
                            )}
                          >
                            {ROLE_LABELS[role] ?? role}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground/80">Keine Rollen zugewiesen</span>
                      )}
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      <span>{formatLastUpdated(memberModalMember.stats.lastUpdated)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-start gap-3 sm:items-end">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-border/60 bg-background/60 px-2 py-1 text-[11px] text-muted-foreground"
                    >
                      {memberModalMember.stats.captured}/{memberModalMember.stats.total} Maße
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-primary/40 bg-primary/10 px-2 py-1 text-[11px] text-primary"
                    >
                      {Math.round(memberModalMember.stats.completion * 100)}%
                    </Badge>
                  </div>
                  <div className="w-full min-w-[160px]">
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted/40">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary via-sky-500 to-violet-500"
                        style={{ width: `${Math.round(memberModalMember.stats.completion * 100)}%` }}
                      />
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDialogState({ mode: "create", memberId: memberModalMember.id })}
                  >
                    Neues Maß erfassen
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {measurementTypeEnum.options.map((type) => {
                  const entry = memberModalMember.measurementMap.get(type) ?? null;
                  const unitLabel = entry ? MEASUREMENT_UNIT_LABELS[entry.unit] ?? entry.unit : undefined;
                  return (
                    <div
                      key={type}
                      className="group relative overflow-hidden rounded-3xl border border-border/50 bg-background/80 p-5 transition hover:border-primary/40 hover:bg-primary/5"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-violet-500/10 opacity-0 transition group-hover:opacity-100" />
                      <div className="relative z-10 flex h-full flex-col gap-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/80">
                            {MEASUREMENT_TYPE_LABELS[type]}
                          </span>
                          {entry ? (
                            <Badge variant="outline" className="border-border/50 bg-background/60 text-[10px] text-foreground/80">
                              Aktualisiert
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-destructive/60 bg-destructive/10 text-[10px] text-destructive">
                              Fehlt
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-semibold tracking-tight text-foreground">
                            {entry ? formatValue(entry.value) : "—"}
                          </span>
                          {entry ? <span className="text-sm text-muted-foreground">{unitLabel}</span> : null}
                        </div>
                        <p className="min-h-[2.5rem] text-xs leading-snug text-muted-foreground/80">
                          {entry?.note ? entry.note : "Noch keine Notiz hinterlegt."}
                        </p>
                        <div className="mt-auto flex items-center justify-between text-[11px] text-muted-foreground/70">
                          <span>
                            {entry?.updatedAt
                              ? ABSOLUTE_DATE_FORMATTER.format(new Date(entry.updatedAt))
                              : "Keine Historie"}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() =>
                              entry
                                ? setDialogState({ mode: "edit", memberId: memberModalMember.id, entry })
                                : setDialogState({ mode: "create", memberId: memberModalMember.id, initialType: type })
                            }
                          >
                            {entry ? "Bearbeiten" : "Erfassen"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-10 text-center text-sm text-muted-foreground">
              <AlertTriangle className="h-6 w-6 text-muted-foreground" />
              <p>Profilinformationen konnten nicht geladen werden. Schließe das Fenster und versuche es erneut.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogState !== null} onOpenChange={(open) => (!open ? handleDialogClose() : null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogState?.mode === "edit"
                ? `${MEASUREMENT_TYPE_LABELS[dialogState.entry.type]} anpassen`
                : "Neues Maß hinzufügen"}
            </DialogTitle>
            {dialogMember ? (
              <DialogDescription>
                Änderungen werden direkt im Profil von {dialogMember.displayName} sichtbar.
              </DialogDescription>
            ) : null}
          </DialogHeader>
          {dialogState ? (
            <MeasurementForm
              initialData={
                dialogState.mode === "edit"
                  ? {
                      type: dialogState.entry.type,
                      value: dialogState.entry.value,
                      unit: dialogState.entry.unit,
                      note: dialogState.entry.note ?? "",
                    }
                  : dialogState.initialType
                  ? { type: dialogState.initialType }
                  : undefined
              }
              disableTypeSelection={dialogState.mode === "edit"}
              onSubmit={(formData) => handleSubmit(dialogState.memberId, formData)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition",
        active
          ? "border-primary/60 bg-primary/15 text-primary"
          : "border-border/60 bg-background/80 text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function StatBlock({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/15 p-3 text-sm text-muted-foreground">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground/80">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground/70">{hint}</p>
    </div>
  );
}

function buildDisplayName(member: {
  firstName: string | null;
  lastName: string | null;
  name: string | null;
}) {
  const parts = [member.firstName?.trim(), member.lastName?.trim()].filter(Boolean);
  if (parts.length) {
    return parts.join(" ");
  }
  if (member.name?.trim()) {
    return member.name.trim();
  }
  return "Unbekanntes Mitglied";
}

function formatValue(value: number) {
  return Number.isFinite(value)
    ? value.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 1 })
    : "—";
}

function formatLastUpdated(value: string | null) {
  if (!value) {
    return "Noch keine Maße";
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return "Letzte Aktualisierung unbekannt";
  }
  const date = new Date(timestamp);
  return formatRelativeWithAbsolute(date, { absoluteFormatter: ABSOLUTE_DATE_FORMATTER }).combined;
}

