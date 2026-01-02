"use client";

import { useMemo, useState } from "react";

import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OnboardingMembersOverview } from "@/lib/onboarding/dashboard-schemas";
import { cn } from "@/lib/utils";

type MembersOverviewTabProps = {
  data: OnboardingMembersOverview;
};

function formatDate(value: string | null) {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function renderRoles(
  roles: OnboardingMembersOverview["rows"][number]["actingRoles"],
) {
  if (!roles || roles.length === 0) {
    return <span className="text-muted-foreground">–</span>;
  }

  return (
    <div className="space-y-1 text-sm text-foreground">
      {roles.map((role) => (
        <div key={`${role.label}-${role.percentage ?? "plain"}`} className="leading-tight">
          {role.label}
          {role.percentage ? (
            <span className="text-xs text-muted-foreground"> ({role.percentage}%)</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function renderAllergies(allergies: string[]) {
  if (!allergies || allergies.length === 0) {
    return <span className="text-muted-foreground">–</span>;
  }

  return (
    <div className="space-y-1 text-sm text-foreground">
      {allergies.map((entry) => (
        <div key={entry} className="leading-tight">
          {entry}
        </div>
      ))}
    </div>
  );
}

function renderPhotoConsent(value: OnboardingMembersOverview["rows"][number]["photoConsent"]) {
  const granted = value === "approved";
  const label = granted ? "Ja" : "Nein";
  return (
    <Badge
      variant={granted ? "outline" : "secondary"}
      className={cn(
        "min-w-[90px] justify-center px-3 py-1 text-sm",
        granted
          ? "border-success/60 bg-success/10 text-success"
          : "border-border/70 bg-muted/60 text-foreground",
      )}
    >
      {label}
    </Badge>
  );
}

function MemberDetail({ member }: { member: OnboardingMembersOverview["rows"][number] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <UserAvatar
          name={member.avatar?.name ?? "Unbekannt"}
          email={member.avatar?.email}
          size={56}
          className="text-lg font-semibold text-foreground"
        />
        <div>
          <p className="text-base font-semibold text-foreground">
            {[member.firstName, member.lastName].filter(Boolean).join(" ") || member.avatar?.name}
          </p>
          <p className="text-sm text-muted-foreground">{member.email ?? "Keine E-Mail"}</p>
        </div>
      </div>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Vorname</Label>
          <p className="text-sm text-foreground">{member.firstName ?? "–"}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Nachname</Label>
          <p className="text-sm text-foreground">{member.lastName ?? "–"}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Geburtsdatum</Label>
          <p className="text-sm text-foreground">{formatDate(member.birthdate)}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Alter</Label>
          <p className="text-sm text-foreground">{member.age ?? "–"}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">E-Mail-Adresse</Label>
          <p className="text-sm text-foreground break-words">{member.email ?? "–"}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Schule oder Beschäftigung</Label>
          <p className="text-sm text-foreground">{member.schoolOrEmployment ?? "–"}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Klasse</Label>
          <p className="text-sm text-foreground">{member.className ?? "–"}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Rollen</Label>
          {renderRoles(member.actingRoles)}
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Gewerke</Label>
          {renderRoles(member.crewRoles)}
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Ernährung</Label>
          <p className="text-sm text-foreground">{member.nutrition ?? "–"}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Allergien</Label>
          {renderAllergies(member.allergies)}
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Fotoeinverständnis</Label>
          {renderPhotoConsent(member.photoConsent)}
        </div>
      </div>
    </div>
  );
}

export function MembersOverviewTab({ data }: MembersOverviewTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(data.rows[0]?.id ?? null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return data.rows;
    return data.rows.filter((row) =>
      [row.firstName, row.lastName, row.avatar?.name]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(term)),
    );
  }, [data.rows, searchTerm]);

  const selectedMember = data.rows.find((row) => row.id === selectedMemberId) ?? null;

  return (
    <div className="space-y-6">
      <Card className="hidden md:block border-border/70 bg-card shadow-sm">
        <CardHeader className="border-b border-border/70 pb-4">
          <CardTitle className="text-lg">Mitgliederübersicht</CardTitle>
          <p className="text-sm text-muted-foreground">
            Strukturierte Tabelle mit festen Spalten und direktem Zugriff auf die Detailansicht.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                <TableRow className="border-b border-border/70">
                  <TableHead className="h-11 px-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Profilbild
                  </TableHead>
                  <TableHead className="h-11 px-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Vorname
                  </TableHead>
                  <TableHead className="h-11 px-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Nachname
                  </TableHead>
                  <TableHead className="h-11 px-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Geburtsdatum
                  </TableHead>
                  <TableHead className="h-11 px-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Alter
                  </TableHead>
                  <TableHead className="h-11 px-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    E-Mail-Adresse
                  </TableHead>
                  <TableHead className="h-11 px-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Schule / Beschäftigung
                  </TableHead>
                  <TableHead className="h-11 px-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Klasse
                  </TableHead>
                  <TableHead className="h-11 px-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Rollen
                  </TableHead>
                  <TableHead className="h-11 px-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Gewerke
                  </TableHead>
                  <TableHead className="h-11 px-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Ernährung
                  </TableHead>
                  <TableHead className="h-11 px-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Allergien
                  </TableHead>
                  <TableHead className="h-11 px-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Fotoeinverständnis
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="h-24 text-center text-sm text-muted-foreground">
                      Keine Mitglieder vorhanden.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.rows.map((row) => {
                    const displayName = [row.firstName, row.lastName].filter(Boolean).join(" ") || row.avatar?.name;
                    return (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/40"
                        onClick={() => {
                          setSelectedMemberId(row.id);
                          setIsDetailOpen(true);
                        }}
                      >
                        <TableCell className="px-3 align-top">
                          <div className="pt-1">
                            <UserAvatar
                              name={displayName || "Unbekannt"}
                              email={row.email ?? row.avatar?.email}
                              size={40}
                              className="text-sm font-semibold text-foreground"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="px-3 align-top text-sm text-foreground">{row.firstName ?? "–"}</TableCell>
                        <TableCell className="px-3 align-top text-sm text-foreground">{row.lastName ?? "–"}</TableCell>
                        <TableCell className="px-3 align-top text-sm text-foreground">{formatDate(row.birthdate)}</TableCell>
                        <TableCell className="px-3 align-top text-sm text-foreground">{row.age ?? "–"}</TableCell>
                        <TableCell className="px-3 align-top text-sm text-foreground">
                          <span className="break-words">{row.email ?? "–"}</span>
                        </TableCell>
                        <TableCell className="px-3 align-top text-sm text-foreground">{row.schoolOrEmployment ?? "–"}</TableCell>
                        <TableCell className="px-3 align-top text-sm text-foreground">{row.className ?? "–"}</TableCell>
                        <TableCell className="px-3 align-top">{renderRoles(row.actingRoles)}</TableCell>
                        <TableCell className="px-3 align-top">{renderRoles(row.crewRoles)}</TableCell>
                        <TableCell className="px-3 align-top text-sm text-foreground">{row.nutrition ?? "–"}</TableCell>
                        <TableCell className="px-3 align-top">{renderAllergies(row.allergies)}</TableCell>
                        <TableCell className="px-3 align-top">{renderPhotoConsent(row.photoConsent)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4 md:hidden">
        <Card className="border-border/70 bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Mitglieder suchen</CardTitle>
            <p className="text-sm text-muted-foreground">
              Finde Personen nach Vor- oder Nachname und öffne die Detailansicht.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Vor- oder Nachname"
              className="h-10"
            />
            <div className="divide-y divide-border rounded-lg border border-border/70">
              {filteredRows.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground">Keine Treffer.</div>
              ) : (
                filteredRows.map((row) => {
                  const label = [row.firstName, row.lastName].filter(Boolean).join(" ") || row.avatar?.name;
                  return (
                    <button
                      key={row.id}
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-3 text-left text-sm transition-colors",
                        selectedMemberId === row.id ? "bg-muted/60 text-foreground" : "text-foreground hover:bg-muted/40",
                      )}
                      onClick={() => setSelectedMemberId(row.id)}
                    >
                      <span className="truncate">{label}</span>
                      <span className="text-xs text-muted-foreground">Detail</span>
                    </button>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {selectedMember ? (
          <Card className="border-border/70 bg-card shadow-sm">
            <CardHeader className="border-b border-border/70 pb-3">
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <MemberDetail member={selectedMember} />
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Sheet open={isDetailOpen && !!selectedMember} onOpenChange={setIsDetailOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Mitglied</SheetTitle>
            <SheetDescription>Vollständige Detailansicht der ausgewählten Person.</SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            {selectedMember ? <MemberDetail member={selectedMember} /> : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
