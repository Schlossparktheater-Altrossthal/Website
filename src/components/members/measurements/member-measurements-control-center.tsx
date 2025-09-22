"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock3, Filter, Search, Sparkles } from "lucide-react";

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
const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat("de-DE", {
  numeric: "auto",
});

const RELATIVE_TIME_UNITS: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
  { unit: "year", seconds: 60 * 60 * 24 * 365 },
  { unit: "month", seconds: 60 * 60 * 24 * 30 },
  { unit: "week", seconds: 60 * 60 * 24 * 7 },
  { unit: "day", seconds: 60 * 60 * 24 },
  { unit: "hour", seconds: 60 * 60 },
  { unit: "minute", seconds: 60 },
  { unit: "second", seconds: 1 },
];

export function MemberMeasurementsControlCenter({
  members,
}: MemberMeasurementsControlCenterProps) {
  const [memberItems, setMemberItems] = useState(() =>
    members.map((member) => ({
      ...member,
      measurements: sortMeasurements(member.measurements),
    })),
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "complete" | "missing">("all");
  const [selectedId, setSelectedId] = useState<string | null>(() => members[0]?.id ?? null);
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!members.length) {
      setSelectedId(null);
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

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredMembers = useMemo(() => {
    return preparedMembers.filter((member) => {
      if (filter === "complete" && member.stats.missing > 0) return false;
      if (filter === "missing" && member.stats.missing === 0) return false;
      if (normalizedSearch && !member.searchText.includes(normalizedSearch)) {
        return false;
      }
      return true;
    });
  }, [preparedMembers, filter, normalizedSearch]);

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
    if (!sortedMembers.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !sortedMembers.some((member) => member.id === selectedId)) {
      setSelectedId(sortedMembers[0]?.id ?? null);
    }
  }, [sortedMembers, selectedId]);

  const activeMember = sortedMembers.find((member) => member.id === selectedId) ?? sortedMembers[0] ?? null;

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

  const dialogMember = dialogState
    ? preparedMembers.find((member) => member.id === dialogState.memberId) ?? null
    : null;

  const handleDialogClose = () => {
    if (saving) return;
    setDialogState(null);
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

  const renderMemberList = () => {
    if (!sortedMembers.length) {
      return (
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
          Keine passenden Mitglieder gefunden. Passe die Filter an oder entferne die Suche.
        </div>
      );
    }

    return (
      <div className="mt-4 space-y-2 overflow-hidden">
        <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {sortedMembers.map((member) => {
            const isActive = member.id === selectedId;
            const completionPercent = Math.round(member.stats.completion * 100);
            return (
              <button
                type="button"
                key={member.id}
                onClick={() => setSelectedId(member.id)}
                className={cn(
                  "group relative w-full overflow-hidden rounded-2xl border border-border/40 px-4 py-3 text-left transition",
                  isActive
                    ? "border-primary/50 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent shadow-[0_10px_30px_-12px_rgba(59,130,246,0.45)]"
                    : "bg-background/70 hover:border-primary/30 hover:bg-primary/5",
                )}
              >
                <div className="flex items-center gap-3">
                  <UserAvatar
                    userId={member.id}
                    firstName={member.firstName}
                    lastName={member.lastName}
                    name={member.name}
                    avatarSource={member.avatarSource}
                    avatarUpdatedAt={member.avatarUpdatedAt}
                    size={40}
                    className="border-border/70"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium text-foreground">{member.displayName}</p>
                      <span className="text-xs text-muted-foreground/80">{completionPercent}%</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground/80">
                      <span>
                        {member.stats.captured}/{member.stats.total} Maße
                      </span>
                      {member.stats.missing > 0 ? (
                        <Badge
                          variant="outline"
                          className="border-destructive/50 bg-destructive/10 px-1.5 py-0 text-[10px] text-destructive"
                        >
                          {member.stats.missing} fehlt
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-success/40 bg-success/10 px-1.5 py-0 text-[10px] text-success"
                        >
                          Vollständig
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/50">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary via-sky-500 to-violet-500 transition-all"
                        style={{ width: `${completionPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-br from-background/95 via-background/70 to-muted/50 p-6 shadow-[0_0_0_1px_rgba(148,163,184,0.15),0_25px_45px_-15px_rgba(15,23,42,0.6)] backdrop-blur">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),transparent_60%)]" />
          <div className="relative z-10 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground/80">Kostüm-Matrix</p>
              <h2 className="font-serif text-xl text-foreground">Anprobe Control Center</h2>
            </div>
            <Badge className="flex items-center gap-1 border-cyan-400/40 bg-cyan-500/10 text-xs text-cyan-200">
              <Sparkles className="h-3 w-3" /> Live Sync
            </Badge>
          </div>
          <div className="relative z-10 mt-6 grid gap-4 sm:grid-cols-3">
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

        <div className="rounded-3xl border border-border/40 bg-background/85 p-4 shadow-[0_15px_35px_-20px_rgba(15,23,42,0.45)] backdrop-blur">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Mitglieder oder Maße suchen"
                className="h-7 flex-1 border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <FilterButton label="Alle" active={filter === "all"} onClick={() => setFilter("all")} />
              <FilterButton
                label="Vollständig"
                active={filter === "complete"}
                onClick={() => setFilter("complete")}
              />
              <FilterButton
                label="Fehlend"
                active={filter === "missing"}
                onClick={() => setFilter("missing")}
              />
            </div>
          </div>

          {renderMemberList()}
        </div>
      </div>

      <div className="rounded-[32px] border border-border/40 bg-gradient-to-br from-background/95 via-background/70 to-muted/50 p-6 shadow-[0_0_0_1px_rgba(148,163,184,0.12),0_30px_60px_-30px_rgba(15,23,42,0.7)] backdrop-blur">
        {activeMember ? (
          <div className="flex h-full flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <UserAvatar
                  userId={activeMember.id}
                  firstName={activeMember.firstName}
                  lastName={activeMember.lastName}
                  name={activeMember.name}
                  avatarSource={activeMember.avatarSource}
                  avatarUpdatedAt={activeMember.avatarUpdatedAt}
                  size={72}
                  className="border-border/70"
                />
                <div>
                  <h3 className="font-serif text-2xl text-foreground">{activeMember.displayName}</h3>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {activeMember.roles.length ? (
                      activeMember.roles.map((role) => (
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
                      <span className="text-muted-foreground">Keine Rollen zugewiesen</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  <span>{formatLastUpdated(activeMember.stats.lastUpdated)}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDialogState({ mode: "create", memberId: activeMember.id })}
                >
                  Neues Maß erfassen
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {measurementTypeEnum.options.map((type) => {
                const entry = activeMember.measurementMap.get(type) ?? null;
                const unitLabel = entry
                  ? MEASUREMENT_UNIT_LABELS[entry.unit] ?? entry.unit
                  : undefined;
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
                        {entry ? (
                          <span className="text-sm text-muted-foreground">{unitLabel}</span>
                        ) : null}
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
                              ? setDialogState({ mode: "edit", memberId: activeMember.id, entry })
                              : setDialogState({ mode: "create", memberId: activeMember.id, initialType: type })
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

            {activeMember.stats.missing > 0 ? (
              <div className="flex flex-col gap-3 rounded-3xl border border-destructive/50 bg-destructive/5 p-5 text-sm text-destructive">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Noch offene Maße</span>
                </div>
                <p className="text-sm text-destructive/80">
                  Es fehlen {activeMember.stats.missing} Angaben. Erfasse die Werte, um das Profil abzuschließen.
                </p>
                <div className="flex flex-wrap gap-2">
                  {activeMember.stats.missingTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setDialogState({ mode: "create", memberId: activeMember.id, initialType: type })}
                      className="rounded-full border border-destructive/40 bg-background/80 px-3 py-1 text-xs text-destructive transition hover:border-destructive/80 hover:bg-destructive/10"
                    >
                      {MEASUREMENT_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-3xl border border-success/50 bg-success/10 p-5 text-sm text-success">
                <Sparkles className="h-4 w-4" />
                <span>Alle Maße sind vollständig erfasst – bereit für die nächste Anprobe.</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-sm text-muted-foreground">
            <AlertTriangle className="h-6 w-6 text-muted-foreground" />
            <p>Keine Mitglieder mit Körpermaßen gefunden. Lege neue Profile an oder passe die Filter an.</p>
          </div>
        )}
      </div>

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
    <div className="rounded-2xl border border-border/40 bg-background/75 p-4 text-sm text-muted-foreground">
      <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/80">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground/70">{hint}</p>
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
  const now = Date.now();
  const diffInSeconds = Math.round((timestamp - now) / 1000);
  for (const { unit, seconds } of RELATIVE_TIME_UNITS) {
    if (Math.abs(diffInSeconds) >= seconds || unit === "second") {
      const relative = RELATIVE_TIME_FORMATTER.format(Math.round(diffInSeconds / seconds), unit);
      const absolute = ABSOLUTE_DATE_FORMATTER.format(new Date(timestamp));
      return `${relative} • ${absolute}`;
    }
  }
  return ABSOLUTE_DATE_FORMATTER.format(new Date(timestamp));
}

