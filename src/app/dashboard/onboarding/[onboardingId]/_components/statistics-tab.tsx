"use client";

import { useMemo, useState } from "react";
import { Download, Filter, RefreshCcw, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  OnboardingDashboardData,
  OnboardingStatisticsActingRole,
} from "@/lib/onboarding/dashboard-schemas";
import {
  filterStatisticsParticipants,
  hasActiveStatisticsFilters,
  normalizeStatisticsFilters,
  type OnboardingStatisticsFilters,
} from "@/lib/onboarding/dashboard-statistics";

const ACTING_ROLE_LABELS: Record<OnboardingStatisticsActingRole, string> = {
  lead: "Hauptrolle",
  supporting: "Nebenrolle",
  ensemble: "Ensemble",
};

const FOCUS_LABELS = {
  acting: "Schauspiel",
  tech: "Technik",
  both: "Act & Tech",
};

type StatisticsTabProps = {
  statistics: OnboardingDashboardData["statistics"];
  onExportPdf?: (filters?: OnboardingStatisticsFilters) => void | Promise<void>;
  isExportingPdf?: boolean;
  isOffline?: boolean;
};

type SortKey = "name" | "age" | "class" | "focus";

export function StatisticsTab({
  statistics,
  onExportPdf,
  isExportingPdf = false,
  isOffline = false,
}: StatisticsTabProps) {
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedFocus, setSelectedFocus] = useState<string | null>(null);
  const [selectedActingRole, setSelectedActingRole] = useState<OnboardingStatisticsActingRole | null>(null);
  const [selectedCrewRole, setSelectedCrewRole] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const filters = useMemo(
    () =>
      normalizeStatisticsFilters({
        search,
        classes: selectedClass ? [selectedClass] : [],
        focuses: selectedFocus ? [selectedFocus as "acting" | "tech" | "both"] : [],
        actingRoles: selectedActingRole ? [selectedActingRole] : [],
        crewRoles: selectedCrewRole ? [selectedCrewRole] : [],
      }),
    [search, selectedActingRole, selectedClass, selectedCrewRole, selectedFocus],
  );

  const filtered = useMemo(
    () => filterStatisticsParticipants(statistics.participants, filters),
    [statistics.participants, filters],
  );

  const sorted = useMemo(() => {
    const result = [...filtered];
    result.sort((a, b) => {
      switch (sortKey) {
        case "age":
          return (a.age ?? Number.POSITIVE_INFINITY) - (b.age ?? Number.POSITIVE_INFINITY);
        case "class":
          return (a.classLabel ?? "").localeCompare(b.classLabel ?? "", "de-DE", { sensitivity: "base" });
        case "focus":
          return FOCUS_LABELS[a.focus].localeCompare(FOCUS_LABELS[b.focus], "de-DE", { sensitivity: "base" });
        case "name":
        default:
          return a.name.localeCompare(b.name, "de-DE", { sensitivity: "base", numeric: true });
      }
    });
    return sortDirection === "desc" ? result.reverse() : result;
  }, [filtered, sortDirection, sortKey]);

  const activeFilters = hasActiveStatisticsFilters(filters);

  const handleSortToggle = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const handleReset = () => {
    setSearch("");
    setSelectedClass(null);
    setSelectedFocus(null);
    setSelectedActingRole(null);
    setSelectedCrewRole(null);
    setSortKey("name");
    setSortDirection("asc");
  };

  const handleExport = () => {
    if (!onExportPdf || isOffline) return;
    onExportPdf(filters);
  };

  return (
    <Card className="space-y-4 border border-border/60 bg-card/70 p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold leading-tight text-foreground">Mitgliederübersicht</h2>
          <p className="text-sm text-muted-foreground">
            {sorted.length} von {statistics.participants.length} Teilnehmenden · kompakte Übersicht pro Zeile
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={handleReset}
              disabled={isOffline}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Filter zurücksetzen
            </Button>
          ) : null}
          {onExportPdf ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExportingPdf || isOffline}
            >
              {isExportingPdf ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} 
              {isExportingPdf ? "Bereite PDF vor…" : "Ansicht als PDF"}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <label className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Suche nach Name, Interessen oder Ernährung"
            className="h-8 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
          />
        </label>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Klasse</Label>
          <Select value={selectedClass ?? undefined} onValueChange={(value) => setSelectedClass(value || null)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Alle Klassen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Alle Klassen</SelectItem>
              {statistics.filters.classes.map((entry) => (
                <SelectItem key={entry} value={entry}>
                  {entry}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Bereich</Label>
          <Select value={selectedFocus ?? undefined} onValueChange={(value) => setSelectedFocus(value || null)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Alle Bereiche" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Alle Bereiche</SelectItem>
              {statistics.filters.focuses.map((focus) => (
                <SelectItem key={focus} value={focus}>
                  {FOCUS_LABELS[focus as keyof typeof FOCUS_LABELS]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Rollengröße</Label>
          <Select
            value={selectedActingRole ?? undefined}
            onValueChange={(value) =>
              setSelectedActingRole((value as OnboardingStatisticsActingRole | "") || null)
            }
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Alle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Alle</SelectItem>
              {statistics.filters.actingRoles.map((role) => (
                <SelectItem key={role} value={role}>
                  {ACTING_ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Gewerk</Label>
          <Select value={selectedCrewRole ?? undefined} onValueChange={(value) => setSelectedCrewRole(value || null)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Alle Gewerke" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Alle Gewerke</SelectItem>
              {statistics.filters.crewRoles.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border border-border/70 bg-card/70">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span>
              Sortierung: {sortKey === "name" ? "Name" : sortKey === "age" ? "Alter" : sortKey === "class" ? "Klasse" : "Bereich"}
              , {sortDirection === "asc" ? "aufsteigend" : "absteigend"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{sorted.length} Einträge sichtbar</span>
          </div>
        </div>
        <div className="max-h-[640px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[240px] cursor-pointer" onClick={() => handleSortToggle("name")}>
                  Name
                </TableHead>
                <TableHead className="w-[160px] cursor-pointer" onClick={() => handleSortToggle("class")}>
                  Klasse & Alter
                </TableHead>
                <TableHead className="w-[260px] cursor-pointer" onClick={() => handleSortToggle("focus")}>
                  Bereich & Rollen
                </TableHead>
                <TableHead>Interessen</TableHead>
                <TableHead>Ernährung</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((participant) => (
                <TableRow key={participant.userId} className="align-top">
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        {participant.name}
                        <Badge variant="outline" className="text-[11px] font-medium">
                          {FOCUS_LABELS[participant.focus]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {participant.joinedAt
                          ? `Teil von ${new Date(participant.joinedAt).getFullYear()}`
                          : "Onboarding läuft"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm">
                      <p className="font-medium text-foreground">{participant.classLabel ?? "–"}</p>
                      <p className="text-xs text-muted-foreground">{participant.age ? `${participant.age} Jahre` : "Alter offen"}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {participant.actingRoleLabel ? (
                        <Badge variant="secondary" className="text-[11px]">
                          {participant.actingRoleLabel}
                        </Badge>
                      ) : null}
                      {participant.crewRoles.map((role) => (
                        <Badge key={role} variant="outline" className="text-[11px]">
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {participant.interests.length ? (
                        participant.interests.map((interest) => (
                          <Badge key={interest} variant="outline" className="text-[11px]">
                            {interest}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">Keine Interessen hinterlegt</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {participant.dietary.length ? (
                        participant.dietary.map((entry) => (
                          <Badge key={entry} variant="outline" className="text-[11px]">
                            {entry}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">keine Angabe</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </Card>
  );
}
