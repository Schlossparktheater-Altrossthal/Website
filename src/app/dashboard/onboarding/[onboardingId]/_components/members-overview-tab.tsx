"use client";

import { type ReactNode, useMemo, useState } from "react";
import { Check, Filter, Minus, Search, Settings, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  photoConsentStatus: "approved" | "pending" | "declined";
};

const TABLE_COLUMNS: { id: keyof MemberRow; label: string }[] = [
  { id: "lastName", label: "Nachname" },
  { id: "firstName", label: "Vorname" },
  { id: "dateOfBirth", label: "Geburtsdatum" },
  { id: "email", label: "E-Mail" },
  { id: "background", label: "Schule" },
  { id: "backgroundClass", label: "Klasse" },
  { id: "rolesActing", label: "Rollen" },
  { id: "rolesCrew", label: "Gewerke" },
  { id: "diet", label: "Ernährung" },
  { id: "allergies", label: "Allergien" },
  { id: "photoConsentStatus", label: "Fotoeinverständnis" },
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

function renderBirthday(dateOfBirth: Date | null): ReactNode {
  const formattedDate = formatDate(dateOfBirth);

  return <span className="text-sm font-medium text-foreground">{formattedDate}</span>;
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
  const photoConsentStatus: MemberRow["photoConsentStatus"] =
    photoConsent?.status === "approved" || photoConsent?.consentGiven === true
      ? "approved"
      : photoConsent?.status === "pending" || photoConsent?.consentGiven == null
        ? "pending"
        : "declined";

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
    photoConsentStatus,
  };
}

function renderStackedList(items: string[]): ReactNode {
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

function renderRoles(list: { label: string; percentage?: number }[]): ReactNode {
  if (list.length === 0) {
    return <span className="text-muted-foreground">–</span>;
  }
  return (
    <div className="space-y-1">
      {list.map((entry, index) => (
        <p key={`${entry.label}-${index}`} className="text-sm text-foreground">
          {entry.label}
        </p>
      ))}
    </div>
  );
}

function renderPhotoConsent(status: MemberRow["photoConsentStatus"]): ReactNode {
  const iconMap = {
    approved: {
      icon: Check,
      className: "text-success",
      label: "Ja",
    },
    declined: {
      icon: X,
      className: "text-destructive",
      label: "Nein",
    },
    pending: {
      icon: Minus,
      className: "text-muted-foreground",
      label: "Ausstehend",
    },
  } as const;

  const Icon = iconMap[status].icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center justify-center border-border/70 bg-card/80 p-1",
        iconMap[status].className,
      )}
      aria-label={iconMap[status].label}
    >
      <Icon className="h-6 w-6 stroke-[3]" aria-hidden />
    </Badge>
  );
}

export function MembersOverviewTab({ data }: MembersOverviewTabProps) {
  const members = useMemo(() => {
    return data.rows
      .map(parseMemberRow)
      .sort((a, b) => (a.lastName || "").localeCompare(b.lastName || "", "de", { sensitivity: "base" }));
  }, [data.rows]);
  const [query, setQuery] = useState("");

  const filteredMembers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return members;
    return members.filter((member) =>
      `${member.firstName ?? ""} ${member.lastName ?? ""}`.toLowerCase().includes(normalized),
    );
  }, [members, query]);

  return (
    <div className="space-y-6">
      <div className="hidden md:block">
        <Card className="border-border/70 bg-card shadow-sm">
          <CardHeader className="flex flex-col gap-3 border-b border-border/70 pb-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg">Mitgliederübersicht</CardTitle>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Button variant="ghost" size="icon" aria-label="Suche öffnen">
                  <Search className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Filter anpassen">
                  <Filter className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Einstellungen öffnen">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative max-h-[70vh] overflow-x-auto overflow-y-auto">
              <Table className="w-full table-auto">
                <TableHeader className="sticky top-0 z-10 bg-muted/90 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
                  <TableRow className="border-b border-border/80">
                    {TABLE_COLUMNS.map((column) => (
                      <TableHead
                        key={column.id}
                        className="h-11 px-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground"
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
                      <TableRow className="border-b border-border/70 transition-colors hover:bg-muted/40 last:border-b-0" key={member.id}>
                        {TABLE_COLUMNS.map((column) => {
                          switch (column.id) {
                            case "lastName":
                              return (
                                <TableCell
                                  key={`${member.id}-${column.id}`}
                                  className="px-3 align-top text-sm text-foreground whitespace-normal break-words"
                                >
                                  {member.lastName || "–"}
                                </TableCell>
                              );
                            case "firstName":
                              return (
                                <TableCell
                                  key={`${member.id}-${column.id}`}
                                  className="px-3 align-top text-sm text-foreground whitespace-normal break-words"
                                >
                                  {member.firstName || "–"}
                                </TableCell>
                              );
                            case "dateOfBirth":
                              return (
                                <TableCell
                                  key={`${member.id}-${column.id}`}
                                  className="px-3 align-top text-sm text-foreground whitespace-normal break-words"
                                >
                                  {renderBirthday(member.dateOfBirth)}
                                </TableCell>
                              );
                            case "email":
                              return (
                                <TableCell
                                  key={`${member.id}-${column.id}`}
                                  className="px-3 align-top text-sm text-foreground whitespace-normal break-words"
                                >
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
                                <TableCell
                                  key={`${member.id}-${column.id}`}
                                  className="px-3 align-top text-sm text-foreground whitespace-normal break-words"
                                >
                                  {member.background || "–"}
                                </TableCell>
                              );
                            case "backgroundClass":
                              return (
                                <TableCell
                                  key={`${member.id}-${column.id}`}
                                  className="px-3 align-top text-sm text-foreground whitespace-normal break-words"
                                >
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
                                <TableCell
                                  key={`${member.id}-${column.id}`}
                                  className="px-3 align-top text-sm text-foreground whitespace-normal break-words"
                                >
                                  {member.diet || "–"}
                                </TableCell>
                              );
                            case "allergies":
                              return (
                                <TableCell key={`${member.id}-${column.id}`} className="px-3 align-top">
                                  {renderStackedList(member.allergies)}
                                </TableCell>
                              );
                            case "photoConsentStatus":
                              return (
                                <TableCell key={`${member.id}-${column.id}`} className="px-3 align-top">
                                  {renderPhotoConsent(member.photoConsentStatus)}
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
      </div>

      <div className="space-y-4 md:hidden">
        <Card className="border-border/70 bg-card shadow-sm">
          <CardHeader className="gap-2 border-b border-border/70 pb-4">
            <CardTitle className="text-lg">Mitgliederübersicht</CardTitle>
            <p className="text-sm text-muted-foreground">Suchliste nach Vor- und Nachname.</p>
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
                  <div key={member.id} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm">
                    <span className="font-medium text-foreground">
                      {[member.firstName, member.lastName].filter(Boolean).join(" ") || member.avatar.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
