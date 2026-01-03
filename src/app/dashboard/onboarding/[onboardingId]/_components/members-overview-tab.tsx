"use client";

import { useEffect, useMemo, useState } from "react";

import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  onboardingId: string;
  data: OnboardingMembersOverview;
};

type MemberRow = {
  id: string;
  avatar: { name: string; email?: string | null };
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: Date | null;
  age: number | null;
  email: string | null;
  background: string | null;
  backgroundClass: string | null;
  rolesActing: { label: string; percentage?: number }[];
  rolesCrew: { label: string; percentage?: number }[];
  diet: string | null;
  allergies: string[];
  photoConsentApproved: boolean;
};

const TABLE_COLUMNS: { id: keyof MemberRow; label: string }[] = [
  { id: "avatar", label: "Profilbild" },
  { id: "firstName", label: "Vorname" },
  { id: "lastName", label: "Nachname" },
  { id: "dateOfBirth", label: "Geburtsdatum" },
  { id: "age", label: "Alter" },
  { id: "email", label: "E-Mail-Adresse" },
  { id: "background", label: "Schule oder Beschäftigung" },
  { id: "backgroundClass", label: "Klasse" },
  { id: "rolesActing", label: "Rollen" },
  { id: "rolesCrew", label: "Gewerke" },
  { id: "diet", label: "Ernährung" },
  { id: "allergies", label: "Allergien" },
  { id: "photoConsentApproved", label: "Fotoeinverständnis" },
];

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function formatDate(value: Date | null): string {
  if (!value) return "–";
  return value.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatAge(value: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "–";
  }
  return value.toString();
}

function calculateAge(dateOfBirth: Date | null): number | null {
  if (!dateOfBirth) return null;

  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const hasBirthdayPassedThisYear =
    today.getMonth() > dateOfBirth.getMonth() ||
    (today.getMonth() === dateOfBirth.getMonth() && today.getDate() >= dateOfBirth.getDate());

  if (!hasBirthdayPassedThisYear) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function parseRoles(value: unknown): { label: string; percentage?: number }[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return { label: entry };
      }
      if (entry && typeof entry === "object") {
        const record = entry as { label?: string; value?: number };
        const label = typeof record.label === "string" ? record.label : undefined;
        const percentage =
          typeof record.value === "number" && Number.isFinite(record.value)
            ? Math.round(record.value * 100)
            : undefined;
        return label ? { label, percentage } : null;
      }
      return null;
    })
    .filter((entry): entry is { label: string; percentage?: number } => Boolean(entry));
}

function parseAllergies(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as { allergen?: string; level?: string };
      const allergen = typeof record.allergen === "string" ? record.allergen : null;
      const level = typeof record.level === "string" ? record.level : null;
      if (!allergen) return null;
      return level ? `${allergen} (${level})` : allergen;
    })
    .filter((item): item is string => Boolean(item));
}

function parseMemberRow(row: OnboardingMembersOverview["rows"][number]): MemberRow {
  const values = row.values as Record<string, unknown>;
  const avatar = values.avatar as { name?: string; email?: string | null };
  const firstName = typeof values.firstName === "string" ? values.firstName : null;
  const lastName = typeof values.lastName === "string" ? values.lastName : null;
  const dateOfBirth = parseDate(values.dateOfBirth);
  const ageFromData = typeof values.age === "number" && Number.isFinite(values.age) ? values.age : null;
  const email = typeof values.email === "string" ? values.email : null;
  const background = typeof values.background === "string" ? values.background : null;
  const backgroundClass = typeof values.backgroundClass === "string" ? values.backgroundClass : null;
  const diet = typeof values.diet === "string" ? values.diet : null;
  const photoConsent = values.photoConsent as { status?: string; consentGiven?: boolean | null } | undefined;
  const photoConsentApproved =
    (photoConsent?.status === "approved" || photoConsent?.consentGiven === true) ?? false;

  return {
    id: row.id,
    avatar: {
      name: typeof avatar?.name === "string" && avatar.name.trim() ? avatar.name : "Unbekannt",
      email,
    },
    firstName,
    lastName,
    dateOfBirth,
    age: calculateAge(dateOfBirth) ?? ageFromData,
    email,
    background,
    backgroundClass,
    rolesActing: parseRoles(values.rolesActing),
    rolesCrew: parseRoles(values.rolesCrew),
    diet,
    allergies: parseAllergies(values.allergies),
    photoConsentApproved,
  };
}

function renderStackedList(items: string[]): JSX.Element {
  if (items.length === 0) {
    return <span className="text-muted-foreground">–</span>;
  }
  return (
    <div className="space-y-1">
      {items.map((item) => (
        <p key={item} className="text-sm text-foreground">
          {item}
        </p>
      ))}
    </div>
  );
}

function renderRoles(list: { label: string; percentage?: number }[]): JSX.Element {
  if (list.length === 0) {
    return <span className="text-muted-foreground">–</span>;
  }
  return (
    <div className="space-y-1">
      {list.map((entry) => (
        <p key={`${entry.label}-${entry.percentage ?? "none"}`} className="text-sm text-foreground">
          {entry.label}
          {typeof entry.percentage === "number" ? ` (${entry.percentage}%)` : ""}
        </p>
      ))}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</Label>
      <div className="text-sm text-foreground">{value}</div>
    </div>
  );
}

function MemberDetailCard({ member }: { member: MemberRow | null }) {
  if (!member) {
    return (
      <Card className="border-border/70 bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Detailansicht</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Keine Person ausgewählt.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/70 bg-card shadow-sm">
      <CardHeader className="gap-3 border-b border-border/70 pb-4">
        <CardTitle className="text-base">Detailansicht</CardTitle>
        <div className="flex items-center gap-3">
          <UserAvatar
            name={member.avatar.name}
            email={member.avatar.email ?? undefined}
            size={56}
            className="text-sm font-semibold"
          />
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground">
              {[member.firstName, member.lastName].filter(Boolean).join(" ") || member.avatar.name}
            </p>
            {member.email ? <p className="text-xs text-muted-foreground">{member.email}</p> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <DetailField label="Vorname" value={member.firstName || "–"} />
        <DetailField label="Nachname" value={member.lastName || "–"} />
        <DetailField label="Geburtsdatum" value={formatDate(member.dateOfBirth)} />
        <DetailField label="Alter" value={formatAge(member.age)} />
        <DetailField label="E-Mail-Adresse" value={member.email ? member.email : "–"} />
        <DetailField label="Schule oder Beschäftigung" value={member.background || "–"} />
        <DetailField label="Klasse" value={member.backgroundClass || "–"} />
        <DetailField label="Rollen" value={renderRoles(member.rolesActing)} />
        <DetailField label="Gewerke" value={renderRoles(member.rolesCrew)} />
        <DetailField label="Ernährung" value={member.diet || "–"} />
        <DetailField label="Allergien" value={renderStackedList(member.allergies)} />
        <DetailField
          label="Fotoeinverständnis"
          value={
            <Badge
              variant="outline"
              className={cn(
                "px-2 py-1 text-xs font-semibold",
                member.photoConsentApproved
                  ? "border-success/60 bg-success/10 text-success"
                  : "border-destructive/60 bg-destructive/10 text-destructive",
              )}
            >
              {member.photoConsentApproved ? "Ja" : "Nein"}
            </Badge>
          }
        />
      </CardContent>
    </Card>
  );
}

export function MembersOverviewTab({ data }: MembersOverviewTabProps) {
  const members = useMemo(() => data.rows.map(parseMemberRow), [data.rows]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(members[0]?.id ?? null);
  const [query, setQuery] = useState("");

  const filteredMembers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return members;
    return members.filter((member) =>
      `${member.firstName ?? ""} ${member.lastName ?? ""}`.toLowerCase().includes(normalized),
    );
  }, [members, query]);

  useEffect(() => {
    if (!selectedMemberId || !filteredMembers.some((member) => member.id === selectedMemberId)) {
      setSelectedMemberId(filteredMembers[0]?.id ?? null);
    }
  }, [filteredMembers, selectedMemberId]);

  const selectedMember =
    filteredMembers.find((member) => member.id === selectedMemberId) ??
    members.find((member) => member.id === selectedMemberId) ??
    filteredMembers[0] ??
    null;

  return (
    <div className="space-y-6">
      <div className="hidden md:grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
        <Card className="border-border/70 bg-card shadow-sm">
          <CardHeader className="flex flex-col gap-2 border-b border-border/70 pb-4">
            <CardTitle className="text-lg">Mitgliederübersicht</CardTitle>
            <p className="text-sm text-muted-foreground">
              Strukturierte Tabelle mit festen Spalten und klar getrennten Kategorien.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative max-h-[70vh] overflow-auto">
              <Table className="min-w-full">
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow className="border-b border-border/70">
                    {TABLE_COLUMNS.map((column) => (
                      <TableHead
                        key={column.id}
                        className="h-11 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                      >
                        {column.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={TABLE_COLUMNS.length} className="h-24 text-center text-sm text-muted-foreground">
                        Keine Mitglieder gefunden.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMembers.map((member) => (
                      <TableRow
                        key={member.id}
                        className={cn(
                          "cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/40",
                          selectedMemberId === member.id ? "bg-muted/40" : "",
                        )}
                        onClick={() => setSelectedMemberId(member.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedMemberId(member.id);
                          }
                        }}
                        tabIndex={0}
                        aria-selected={selectedMemberId === member.id}
                      >
                        {TABLE_COLUMNS.map((column) => {
                          switch (column.id) {
                            case "avatar":
                              return (
                                <TableCell key={`${member.id}-${column.id}`} className="px-3 align-top">
                                  <UserAvatar
                                    name={member.avatar.name}
                                    email={member.avatar.email ?? undefined}
                                    size={40}
                                    className="text-sm font-semibold"
                                  />
                                </TableCell>
                              );
                            case "firstName":
                              return (
                                <TableCell key={`${member.id}-${column.id}`} className="px-3 align-top text-sm text-foreground">
                                  {member.firstName || "–"}
                                </TableCell>
                              );
                            case "lastName":
                              return (
                                <TableCell key={`${member.id}-${column.id}`} className="px-3 align-top text-sm text-foreground">
                                  {member.lastName || "–"}
                                </TableCell>
                              );
                            case "dateOfBirth":
                              return (
                                <TableCell key={`${member.id}-${column.id}`} className="px-3 align-top text-sm text-foreground">
                                  {formatDate(member.dateOfBirth)}
                                </TableCell>
                              );
                            case "age":
                              return (
                                <TableCell key={`${member.id}-${column.id}`} className="px-3 align-top text-sm text-foreground">
                                  {formatAge(member.age)}
                                </TableCell>
                              );
                            case "email":
                              return (
                                <TableCell key={`${member.id}-${column.id}`} className="px-3 align-top text-sm text-foreground">
                                  {member.email ? (
                                    <a className="underline decoration-border underline-offset-2" href={`mailto:${member.email}`}>
                                      {member.email}
                                    </a>
                                  ) : (
                                    <span className="text-muted-foreground">–</span>
                                  )}
                                </TableCell>
                              );
                            case "background":
                              return (
                                <TableCell key={`${member.id}-${column.id}`} className="px-3 align-top text-sm text-foreground">
                                  {member.background || "–"}
                                </TableCell>
                              );
                            case "backgroundClass":
                              return (
                                <TableCell key={`${member.id}-${column.id}`} className="px-3 align-top text-sm text-foreground">
                                  {member.backgroundClass || "–"}
                                </TableCell>
                              );
                            case "rolesActing":
                              return (
                                <TableCell key={`${member.id}-${column.id}`} className="px-3 align-top">
                                  {renderRoles(member.rolesActing)}
                                </TableCell>
                              );
                            case "rolesCrew":
                              return (
                                <TableCell key={`${member.id}-${column.id}`} className="px-3 align-top">
                                  {renderRoles(member.rolesCrew)}
                                </TableCell>
                              );
                            case "diet":
                              return (
                                <TableCell key={`${member.id}-${column.id}`} className="px-3 align-top text-sm text-foreground">
                                  {member.diet || "–"}
                                </TableCell>
                              );
                            case "allergies":
                              return (
                                <TableCell key={`${member.id}-${column.id}`} className="px-3 align-top">
                                  {renderStackedList(member.allergies)}
                                </TableCell>
                              );
                            case "photoConsentApproved":
                              return (
                                <TableCell key={`${member.id}-${column.id}`} className="px-3 align-top">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "px-2 py-1 text-xs font-semibold",
                                      member.photoConsentApproved
                                        ? "border-success/60 bg-success/10 text-success"
                                        : "border-destructive/60 bg-destructive/10 text-destructive",
                                    )}
                                  >
                                    {member.photoConsentApproved ? "Ja" : "Nein"}
                                  </Badge>
                                </TableCell>
                              );
                            default:
                              return null;
                          }
                        })}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        <MemberDetailCard member={selectedMember} />
      </div>

      <div className="space-y-4 md:hidden">
        <Card className="border-border/70 bg-card shadow-sm">
          <CardHeader className="gap-2 border-b border-border/70 pb-4">
            <CardTitle className="text-lg">Mitgliederübersicht</CardTitle>
            <p className="text-sm text-muted-foreground">
              Suchliste nach Vor- und Nachname, die eine detailreiche Einzelansicht öffnet.
            </p>
            <Input
              placeholder="Person suchen"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="mt-2"
            />
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Mitglieder gefunden.</p>
            ) : (
              <div className="divide-y divide-border rounded-md border border-border/70">
                {filteredMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2 text-left text-sm",
                      selectedMemberId === member.id ? "bg-muted/60" : "hover:bg-muted/40",
                    )}
                    onClick={() => setSelectedMemberId(member.id)}
                  >
                    <span className="font-medium text-foreground">
                      {[member.firstName, member.lastName].filter(Boolean).join(" ") || member.avatar.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <MemberDetailCard member={selectedMember} />
      </div>
    </div>
  );
}
