"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangle,
  ArrowDownAZ,
  ArrowUpAZ,
  BarChart3,
  Clock3,
  FileDown,
  Ruler,
  Settings,
  Users,
} from "lucide-react";

import { MeasurementForm } from "@/components/forms/measurement-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { compareMembersByLastName } from "@/lib/names";
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
  canConfigureMeasurements?: boolean;
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

type SortDirection = "asc" | "desc";

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
  canConfigureMeasurements = false,
}: MemberMeasurementsControlCenterProps) {
  const [memberItems, setMemberItems] = useState(() =>
    members.map((member) => ({
      ...member,
      measurements: sortMeasurements(member.measurements),
    })),
  );
  const [memberSearch, setMemberSearch] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [memberDialogId, setMemberDialogId] = useState<string | null>(null);
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  const [saving, setSaving] = useState(false);
  const [mobileMemberId, setMobileMemberId] = useState<string | null>(null);
  const [activeMeasurementTypes, setActiveMeasurementTypes] = useState<MeasurementType[]>(() => [
    ...measurementTypeEnum.options,
  ]);

  useEffect(() => {
    setMemberItems(
      members.map((member) => ({
        ...member,
        measurements: sortMeasurements(member.measurements),
      })),
    );
  }, [members]);

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
      const missingTypes = activeMeasurementTypes.filter((type) => !measurementMap.has(type));
      const captured = activeMeasurementTypes.filter((type) => measurementMap.has(type)).length;
      const totalTypes = activeMeasurementTypes.length;
      const lastUpdated = member.measurements.reduce<string | null>((latest, entry) => {
        if (!entry.updatedAt) return latest;
        if (!latest || entry.updatedAt > latest) {
          return entry.updatedAt;
        }
        return latest;
      }, null);
      const stats: MemberStats = {
        total: totalTypes,
        captured,
        missing: Math.max(0, totalTypes - captured),
        completion: totalTypes > 0 ? captured / totalTypes : 0,
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
  }, [memberItems, activeMeasurementTypes]);

  const normalizedMemberSearch = memberSearch.trim().toLowerCase();

  const filteredMembers = useMemo(() => {
    return preparedMembers.filter((member) => {
      if (normalizedMemberSearch && !member.searchText.includes(normalizedMemberSearch)) {
        return false;
      }
      return true;
    });
  }, [preparedMembers, normalizedMemberSearch]);

  const sortedMembers = useMemo(() => {
    return [...filteredMembers].sort((a, b) => {
      const comparison = compareMembersByLastName(a, b);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredMembers, sortDirection]);

  const memberSelectOptions = useMemo(() => {
    return [...preparedMembers]
      .sort((a, b) => {
        const comparison = compareMembersByLastName(a, b);
        return sortDirection === "asc" ? comparison : -comparison;
      })
      .map((member) => ({
        value: member.id,
        label: member.displayName,
      }));
  }, [preparedMembers, sortDirection]);

  const mobileMemberOptions = useMemo(() => {
    return [...filteredMembers]
      .sort((a, b) => {
        const comparison = compareMembersByLastName(a, b);
        return sortDirection === "asc" ? comparison : -comparison;
      })
      .map((member) => ({
        value: member.id,
        label: member.displayName,
      }));
  }, [filteredMembers, sortDirection]);

  useEffect(() => {
    if (!mobileMemberOptions.length) {
      setMobileMemberId(null);
      return;
    }
    if (!mobileMemberId || !mobileMemberOptions.some((option) => option.value === mobileMemberId)) {
      setMobileMemberId(mobileMemberOptions[0].value);
    }
  }, [mobileMemberOptions, mobileMemberId]);

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
    return activeMeasurementTypes
      .map<MeasurementRow | null>((type) => {
        const label = MEASUREMENT_TYPE_LABELS[type] ?? type;
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

        return { type, label, entryMap, missingCount, isComplete };
      })
      .filter((row): row is MeasurementRow => row !== null);
  }, [sortedMembers, activeMeasurementTypes]);

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
          headerClassName: "sticky left-0 z-20 min-w-[150px] bg-muted/30 sm:min-w-[170px]",
          cellClassName:
            "sticky left-0 z-10 min-w-[150px] border-r border-border/60 bg-background px-3 py-2 text-sm font-medium text-foreground sm:min-w-[170px] sm:px-4 sm:py-3",
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
          headerClassName: "min-w-[96px] border-l border-border/60 align-bottom sm:min-w-[110px]",
          cellClassName: "min-w-[96px] border-l border-border/60 px-2 py-1.5 sm:min-w-[110px]",
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

  const mobileMember = mobileMemberId
    ? preparedMembers.find((member) => member.id === mobileMemberId) ?? null
    : null;

  const handleDialogClose = () => {
    if (saving) return;
    setDialogState(null);
  };

  const handleMemberDialogClose = () => {
    if (saving) return;
    setMemberDialogId(null);
  };

  const handleDialogMemberChange = (nextMemberId: string) => {
    setDialogState((prev) => {
      if (!prev || prev.mode !== "create") return prev;
      if (prev.memberId === nextMemberId) return prev;
      return {
        ...prev,
        memberId: nextMemberId,
      };
    });
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
      (count, member) =>
        activeMeasurementTypes.every((type) => member.measurements.some((entry) => entry.type === type))
          ? count + 1
          : count,
      0,
    );
    const averageCompletion =
      totalMembers === 0 || activeMeasurementTypes.length === 0
        ? 0
        : memberItems.reduce((sum, member) => {
            const captured = activeMeasurementTypes.filter((type) =>
              member.measurements.some((entry) => entry.type === type),
            ).length;
            return sum + captured / Math.max(1, activeMeasurementTypes.length);
          }, 0) / totalMembers;

    return {
      totalMembers,
      totalMeasurements,
      completedMembers,
      missingMembers: Math.max(0, totalMembers - completedMembers),
      averageCompletion,
    };
  }, [memberItems, activeMeasurementTypes]);

  const toggleMeasurementType = (type: MeasurementType) => {
    setActiveMeasurementTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size === 1) return prev;
        next.delete(type);
      } else {
        next.add(type);
      }
      return measurementTypeEnum.options.filter((option) => next.has(option));
    });
  };

  const handleExportCsv = () => {
    const headers = ["Mitglied", ...activeMeasurementTypes.map((type) => MEASUREMENT_TYPE_LABELS[type])];
    const rows = preparedMembers.map((member) => {
      const values = activeMeasurementTypes.map((type) =>
        formatMeasurementValue(member.measurementMap.get(type) ?? null),
      );
      return [member.displayName, ...values];
    });
    const csvContent = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replaceAll("\"", "\"\"")}"`).join(";"))
      .join("\n");
    downloadFile(new Blob([csvContent], { type: "text/csv;charset=utf-8;" }), "koerpermasse-export.csv");
  };

  const handleExportPdf = () => {
    const tableHeaders = ["Mitglied", ...activeMeasurementTypes.map((type) => MEASUREMENT_TYPE_LABELS[type])];
    const rows = preparedMembers.map((member) => {
      const values = activeMeasurementTypes.map((type) =>
        formatMeasurementValue(member.measurementMap.get(type) ?? null),
      );
      return [member.displayName, ...values];
    });
    const html = buildExportHtml(tableHeaders, rows);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const exportUrl = window.URL.createObjectURL(blob);
    const exportWindow = window.open(exportUrl, "_blank", "noopener,noreferrer");
    if (!exportWindow) {
      window.URL.revokeObjectURL(exportUrl);
      return;
    }
    const triggerPrint = () => {
      exportWindow.focus();
      exportWindow.print();
      window.URL.revokeObjectURL(exportUrl);
    };
    exportWindow.addEventListener("load", triggerPrint, { once: true });
    window.setTimeout(triggerPrint, 250);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatBlock
            label="Ensemble"
            value={NUMBER_FORMATTER.format(globalStats.totalMembers)}
            icon={<Users className="h-4 w-4" aria-hidden />}
          />
          <StatBlock
            label="Erfasste Maße"
            value={NUMBER_FORMATTER.format(globalStats.totalMeasurements)}
            icon={<Ruler className="h-4 w-4" aria-hidden />}
          />
          <StatBlock
            label="Abdeckung"
            value={PERCENT_FORMATTER.format(globalStats.averageCompletion)}
            icon={<BarChart3 className="h-4 w-4" aria-hidden />}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/60 p-3 shadow-sm">
        <div className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-[2fr_auto] lg:items-center">
            <div className="space-y-1">
              <Label htmlFor="measurement-search" className="sr-only">
                Suche
              </Label>
              <Input
                id="measurement-search"
                value={memberSearch}
                onChange={(event) => setMemberSearch(event.target.value)}
                placeholder="Mitglieder oder Rollen suchen"
                className="h-9 text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={
                  sortDirection === "asc" ? "Schauspieler A bis Z sortieren" : "Schauspieler Z bis A sortieren"
                }
                onClick={() => setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
              >
                {sortDirection === "asc" ? (
                  <ArrowDownAZ className="h-4 w-4" aria-hidden />
                ) : (
                  <ArrowUpAZ className="h-4 w-4" aria-hidden />
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between border-warning/60 text-warning hover:border-warning/80 hover:text-warning sm:w-auto"
                  >
                    Export
                    <FileDown className="h-4 w-4 text-warning" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={handleExportCsv}>Als CSV exportieren</DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleExportPdf}>Als PDF exportieren</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {canConfigureMeasurements ? (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Benötigte Maße festlegen"
                    >
                      <Settings className="h-4 w-4" aria-hidden />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Benötigte Maße auswählen</DialogTitle>
                      <DialogDescription>
                        Lege fest, welche Maße für diese Produktion relevant sind. Mindestens ein Maß bleibt aktiv.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                      {measurementTypeEnum.options.map((type) => {
                        const checked = activeMeasurementTypes.includes(type);
                        return (
                          <label
                            key={type}
                            className={cn(
                              "flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2 text-sm",
                              checked ? "bg-muted/60" : "bg-background/70",
                            )}
                          >
                            <span className="text-sm font-medium text-foreground">
                              {MEASUREMENT_TYPE_LABELS[type] ?? type}
                            </span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleMeasurementType(type)}
                              className="h-4 w-4 accent-foreground"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </DialogContent>
                </Dialog>
              ) : null}
            </div>
          </div>
          <div className="space-y-4 sm:hidden">
            <div className="space-y-2">
              <Label htmlFor="mobile-measurement-member">Mitglied auswählen</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select
                  value={mobileMemberId ?? ""}
                  onValueChange={(value) => setMobileMemberId(value)}
                  disabled={saving || mobileMemberOptions.length === 0}
                >
                  <SelectTrigger id="mobile-measurement-member" className="w-full">
                    <SelectValue placeholder="Mitglied wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {mobileMemberOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={!mobileMemberId}
                  onClick={() =>
                    mobileMemberId ? setDialogState({ mode: "create", memberId: mobileMemberId }) : null
                  }
                >
                  Maß hinzufügen
                </Button>
              </div>
            </div>
            {mobileMember ? (
              <div className="grid gap-3">
                {activeMeasurementTypes.map((type) => {
                  const entry = mobileMember.measurementMap.get(type) ?? null;
                  const unitLabel = entry ? MEASUREMENT_UNIT_LABELS[entry.unit] ?? entry.unit : undefined;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() =>
                        entry
                          ? setDialogState({ mode: "edit", memberId: mobileMember.id, entry })
                          : setDialogState({ mode: "create", memberId: mobileMember.id, initialType: type })
                      }
                      className={cn(
                        "flex w-full flex-col gap-2 rounded-xl border border-border/60 bg-background px-4 py-3 text-left text-sm text-foreground shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        entry ? "hover:border-primary/40 hover:bg-primary/5" : "border-dashed border-destructive/60",
                      )}
                    >
                      <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/80">
                        {MEASUREMENT_TYPE_LABELS[type]}
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-semibold">
                          {entry ? formatValue(entry.value) : "—"}
                        </span>
                        <span className={cn("text-xs", entry ? "text-muted-foreground" : "text-destructive")}>
                          {entry ? unitLabel ?? entry.unit : "Fehlt"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-border/60 bg-muted/15 p-4 text-sm text-muted-foreground">
                Keine Mitglieder verfügbar.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-background p-3 shadow-sm sm:p-4">
        <div className="hidden sm:block">
          {sortedMembers.length ? (
            measurementRows.length ? (
              <DataTable columns={columns} data={measurementRows} tableClassName="w-full min-w-[480px] text-xs" />
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-sm text-muted-foreground">
                <AlertTriangle className="h-5 w-5" />
                <p>Keine Maße entsprechen den aktuellen Filtern. Passe die Auswahl an.</p>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-sm text-muted-foreground">
              <AlertTriangle className="h-5 w-5" />
              <p>Keine Mitglieder mit Besetzung gefunden. Lege eine Besetzung an oder entferne Filter.</p>
            </div>
          )}
        </div>
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
                {dialogState?.mode === "edit"
                  ? `Änderungen werden direkt im Profil von ${dialogMember.displayName} sichtbar.`
                  : `Maße werden dem Profil von ${dialogMember.displayName} zugeordnet.`}
              </DialogDescription>
            ) : null}
          </DialogHeader>
          {dialogState ? (
            <div className="space-y-6">
              {dialogState.mode === "create" ? (
                <div className="space-y-2">
                  <Label htmlFor="measurement-member">Mitglied</Label>
                  <Select
                    value={dialogState.memberId}
                    onValueChange={handleDialogMemberChange}
                    disabled={saving || memberSelectOptions.length === 0}
                  >
                    <SelectTrigger id="measurement-member">
                      <SelectValue placeholder="Mitglied wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {memberSelectOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Wähle ein Mitglied der aktuellen Produktion aus, dem das Maß zugeordnet werden soll.
                  </p>
                </div>
              ) : null}
              <MeasurementForm
                key={`${dialogState.mode}-${dialogState.memberId}-${
                  dialogState.mode === "edit"
                    ? dialogState.entry.id
                    : dialogState.initialType ?? "new"
                }`}
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
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatBlock({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-gradient-to-br from-card/90 to-muted/50 px-4 py-3 shadow-sm">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-xl font-bold leading-tight text-foreground">{value}</p>
      </div>
      <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/80 bg-card/80 text-muted-foreground">
        {icon}
      </span>
    </div>
  );
}

function formatMeasurementValue(entry: MeasurementEntry | null) {
  if (!entry) return "—";
  const unitLabel = MEASUREMENT_UNIT_LABELS[entry.unit] ?? entry.unit;
  return `${formatValue(entry.value)} ${unitLabel}`;
}

function downloadFile(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

function buildExportHtml(headers: string[], rows: string[][]) {
  const tableHeader = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const tableRows = rows
    .map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`)
    .join("");
  return `
    <html lang="de">
      <head>
        <meta charset="utf-8" />
        <title>Körpermaße Export</title>
        <style>
          body { font-family: "Inter", sans-serif; margin: 24px; color: #111; }
          h1 { font-size: 18px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
          th { background: #f4f4f5; }
        </style>
      </head>
      <body>
        <h1>Körpermaße Export</h1>
        <table>
          <thead><tr>${tableHeader}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
    </html>
  `;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
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
