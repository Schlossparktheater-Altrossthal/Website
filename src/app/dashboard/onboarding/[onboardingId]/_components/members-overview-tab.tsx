"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";
import type { OnboardingDashboardData } from "@/lib/onboarding/dashboard-schemas";
import { cn } from "@/lib/utils";

const formatList = (items: string[]) => items.join("\n");

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="whitespace-pre-line text-sm text-foreground/90">{value ?? "—"}</div>
    </div>
  );
}

function MemberDetail({ member }: { member: OnboardingDashboardData["membersOverview"][number] }) {
  const actingRoles = member.actingRoles.length
    ? member.actingRoles.map((role) => `${role.label}${role.share !== null ? ` (${role.share}%)` : ""}`)
    : [];
  const crewRoles = member.crewRoles.length
    ? member.crewRoles.map((role) => `${role.label}${role.share !== null ? ` (${role.share}%)` : ""}`)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <UserAvatar
          userId={member.userId}
          firstName={member.firstName ?? undefined}
          lastName={member.lastName ?? undefined}
          name={[member.firstName, member.lastName].filter(Boolean).join(" ")}
          email={member.email ?? undefined}
          avatarSource={member.avatarSource ?? undefined}
          avatarUpdatedAt={member.avatarUpdatedAt ?? undefined}
          size={56}
          className="h-14 w-14"
        />
        <div>
          <p className="text-lg font-semibold text-foreground">
            {[member.firstName, member.lastName].filter(Boolean).join(" ") || "Unbekannt"}
          </p>
          <p className="text-sm text-muted-foreground">Onboarding-Profil</p>
        </div>
      </div>
      <div className="space-y-3 divide-y divide-border/60 rounded-2xl border border-border/60 bg-muted/10 p-4">
        <DetailRow label="Vorname" value={member.firstName || "–"} />
        <DetailRow label="Nachname" value={member.lastName || "–"} />
        <DetailRow label="Geburtsdatum" value={member.dateOfBirth || "–"} />
        <DetailRow label="Alter" value={member.age !== null ? `${member.age}` : "–"} />
        <DetailRow label="E-Mail-Adresse" value={member.email || "–"} />
        <DetailRow label="Schule oder Beschäftigung" value={member.schoolOrOccupation || "–"} />
        <DetailRow label="Klasse" value={member.classLabel || "–"} />
        <DetailRow label="Rollen" value={actingRoles.length ? formatList(actingRoles) : "–"} />
        <DetailRow label="Gewerke" value={crewRoles.length ? formatList(crewRoles) : "–"} />
        <DetailRow label="Ernährung" value={member.diet || "–"} />
        <DetailRow
          label="Allergien"
          value={
            member.allergies.length
              ? formatList(member.allergies.map((entry) => `${entry.label} (${entry.severity})`))
              : "–"
          }
        />
        <DetailRow
          label="Fotoeinverständnis"
          value={
            member.photoConsent ? (
              <Badge variant="success" className="font-semibold">Ja</Badge>
            ) : (
              <Badge variant="destructive" className="font-semibold">Nein</Badge>
            )
          }
        />
      </div>
    </div>
  );
}

export function MembersOverviewTab({
  members,
}: {
  members: OnboardingDashboardData["membersOverview"];
}) {
  const [query, setQuery] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(members[0]?.userId ?? null);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return members;
    return members.filter((member) => {
      const name = [member.firstName, member.lastName].filter(Boolean).join(" ").toLowerCase();
      const email = (member.email ?? "").toLowerCase();
      return name.includes(term) || email.includes(term);
    });
  }, [members, query]);

  const selectedMember = members.find((member) => member.userId === selectedMemberId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Mitgliederübersicht</p>
          <p className="text-sm text-muted-foreground/90">
            Alle Teilnehmer des Onboardings mit vollständigen Profilangaben.
          </p>
        </div>
        <div className="hidden text-sm text-muted-foreground md:block">
          {filtered.length} von {members.length} Personen
        </div>
      </div>

      <div className="hidden md:block">
        <div className="overflow-x-auto rounded-2xl border border-border/60 shadow-sm">
          <table className="min-w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {[
                  "Profil",
                  "Vorname",
                  "Nachname",
                  "Geburtsdatum",
                  "Alter",
                  "E-Mail",
                  "Schule/Beschäftigung",
                  "Klasse",
                  "Rollen",
                  "Gewerke",
                  "Ernährung",
                  "Allergien",
                  "Foto",
                ].map((heading) => (
                  <th key={heading} className="px-3 py-3 align-bottom">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((member) => {
                const actingRoles = member.actingRoles.length
                  ? member.actingRoles.map((role) => `${role.label}${role.share !== null ? ` (${role.share}%)` : ""}`)
                  : [];
                const crewRoles = member.crewRoles.length
                  ? member.crewRoles.map((role) => `${role.label}${role.share !== null ? ` (${role.share}%)` : ""}`)
                  : [];

                return (
                  <tr
                    key={member.userId}
                    className="border-b border-border/60 transition hover:bg-muted/40"
                    onClick={() => {
                      setSelectedMemberId(member.userId);
                      setDetailOpen(true);
                    }}
                  >
                    <td className="px-3 py-2">
                      <UserAvatar
                        userId={member.userId}
                        firstName={member.firstName ?? undefined}
                        lastName={member.lastName ?? undefined}
                        name={[member.firstName, member.lastName].filter(Boolean).join(" ")}
                        email={member.email ?? undefined}
                        avatarSource={member.avatarSource ?? undefined}
                        avatarUpdatedAt={member.avatarUpdatedAt ?? undefined}
                        size={40}
                        className="h-10 w-10"
                      />
                    </td>
                    <td className="px-3 py-2 align-top font-medium text-foreground">{member.firstName || "–"}</td>
                    <td className="px-3 py-2 align-top font-medium text-foreground">{member.lastName || "–"}</td>
                    <td className="px-3 py-2 align-top text-muted-foreground">{member.dateOfBirth || "–"}</td>
                    <td className="px-3 py-2 align-top text-muted-foreground">{member.age ?? "–"}</td>
                    <td className="px-3 py-2 align-top text-muted-foreground">{member.email || "–"}</td>
                    <td className="px-3 py-2 align-top text-muted-foreground">{member.schoolOrOccupation || "–"}</td>
                    <td className="px-3 py-2 align-top text-muted-foreground">{member.classLabel || "–"}</td>
                    <td className="px-3 py-2 align-top whitespace-pre-line text-foreground/80">
                      {actingRoles.length ? actingRoles.join("\n") : "–"}
                    </td>
                    <td className="px-3 py-2 align-top whitespace-pre-line text-foreground/80">
                      {crewRoles.length ? crewRoles.join("\n") : "–"}
                    </td>
                    <td className="px-3 py-2 align-top text-foreground/80">{member.diet || "–"}</td>
                    <td className="px-3 py-2 align-top whitespace-pre-line text-foreground/80">
                      {member.allergies.length
                        ? member.allergies.map((entry) => `${entry.label} (${entry.severity})`).join("\n")
                        : "–"}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {member.photoConsent ? (
                        <Badge variant="success" className="text-xs font-semibold">Ja</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs font-semibold">Nein</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4 md:hidden">
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 shadow-sm">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Search className="h-4 w-4" aria-hidden />
            <span>Suche</span>
          </label>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Vor- oder Nachname"
            className="mt-2"
          />
        </div>
        <div className="space-y-2">
          {filtered.map((member) => {
            const fullName = [member.firstName, member.lastName].filter(Boolean).join(" ") || "Unbekannt";
            const isActive = member.userId === selectedMemberId;
            return (
              <button
                type="button"
                key={member.userId}
                onClick={() => {
                  setSelectedMemberId(member.userId);
                  setDetailOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition",
                  isActive
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border/70 bg-background text-foreground hover:bg-muted/40",
                )}
              >
                <span className="truncate">{fullName}</span>
                <Badge variant={member.photoConsent ? "success" : "outline"} className="text-[11px] font-semibold">
                  {member.photoConsent ? "Foto ok" : "Ohne Foto"}
                </Badge>
              </button>
            );
          })}
        </div>
        {selectedMember ? (
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-foreground">Detailansicht</CardTitle>
            </CardHeader>
            <CardContent>
              <MemberDetail member={selectedMember} />
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Dialog open={detailOpen && Boolean(selectedMember)} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Profil-Details</DialogTitle>
          </DialogHeader>
          {selectedMember ? <MemberDetail member={selectedMember} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
