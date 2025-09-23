"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { CheckedState } from "@radix-ui/react-checkbox";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS, ROLES } from "@/lib/roles";
import { cn } from "@/lib/utils";

import {
  discardRehearsalDraftAction,
  publishRehearsalAction,
  updateRehearsalDraftAction,
  updateRehearsalAction,
} from "./actions";
import {
  REGISTRATION_DEADLINE_OPTIONS,
  REGISTRATION_DEADLINE_OFFSETS,
  type RegistrationDeadlineOption,
  computeRegistrationDeadline,
} from "./registration-deadline-options";

type MemberOption = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  extraRoles: string[];
};

type RehearsalEditorProps = {
  rehearsal: {
    id: string;
    status: string;
    title: string;
    start: string;
    location: string;
    description: string | null;
    inviteeIds: string[];
    registrationDeadline: string | null;
  };
  members: MemberOption[];
  initialBlockedUserIds: string[];
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

function displayName(member: MemberOption) {
  return member.name?.trim() || member.email?.trim() || "Unbekannt";
}

function toDateString(iso: string) {
  return iso.slice(0, 10);
}

function toTimeString(iso: string) {
  return iso.slice(11, 16);
}

function detectRegistrationDeadlineOption(
  startIso: string,
  deadlineIso: string | null,
): RegistrationDeadlineOption {
  if (!deadlineIso) {
    return "none";
  }

  const start = new Date(startIso);
  const deadline = new Date(deadlineIso);
  const startMs = start.getTime();
  const deadlineMs = deadline.getTime();

  if (Number.isNaN(startMs) || Number.isNaN(deadlineMs)) {
    return "1w";
  }

  const diff = startMs - deadlineMs;
  if (diff <= 0) {
    return "none";
  }

  let closestOption: RegistrationDeadlineOption = "1w";
  let smallestDelta = Number.POSITIVE_INFINITY;

  for (const option of REGISTRATION_DEADLINE_OPTIONS) {
    const offset = REGISTRATION_DEADLINE_OFFSETS[option.value];
    if (!offset) continue;
    const delta = Math.abs(diff - offset);
    if (delta < smallestDelta) {
      smallestDelta = delta;
      closestOption = option.value;
    }
  }

  return closestOption;
}

function parseLocalDateTime(date: string, time: string) {
  if (!date || !time) {
    return null;
  }
  const result = new Date(`${date}T${time}`);
  if (Number.isNaN(result.getTime())) {
    return null;
  }
  return result;
}

export function RehearsalEditor({ rehearsal, members, initialBlockedUserIds }: RehearsalEditorProps) {
  const router = useRouter();
  const isDraft = rehearsal.status === "DRAFT";

  const [title, setTitle] = useState(rehearsal.title);
  const [date, setDate] = useState(toDateString(rehearsal.start));
  const [time, setTime] = useState(toTimeString(rehearsal.start));
  const [location, setLocation] = useState(rehearsal.location);
  const [description, setDescription] = useState(rehearsal.description ?? "");
  const [selectedInvitees, setSelectedInvitees] = useState<string[]>(() => Array.from(new Set(rehearsal.inviteeIds)));
  const [deadlineOption, setDeadlineOption] = useState<RegistrationDeadlineOption>(() =>
    detectRegistrationDeadlineOption(rehearsal.start, rehearsal.registrationDeadline),
  );
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(() => new Set(initialBlockedUserIds));
  const [isCheckingBlocks, setIsCheckingBlocks] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isPublishing, startPublish] = useTransition();
  const [isDiscarding, startDiscard] = useTransition();

  const startDateTime = useMemo(() => parseLocalDateTime(date, time), [date, time]);
  const deadlinePreviewDate = useMemo(() => {
    if (!startDateTime) {
      return null;
    }
    return computeRegistrationDeadline(startDateTime, deadlineOption);
  }, [startDateTime, deadlineOption]);
  const deadlineFormatter = useMemo(
    () => new Intl.DateTimeFormat("de-DE", { dateStyle: "full", timeStyle: "short" }),
    [],
  );
  const deadlinePreviewText = useMemo(() => {
    if (!deadlinePreviewDate) {
      return "Es wird keine Rückmeldefrist gesetzt.";
    }
    return `Frist endet am ${deadlineFormatter.format(deadlinePreviewDate)}.`;
  }, [deadlineFormatter, deadlinePreviewDate]);

  const groupedMembers = useMemo(() => {
    const map = new Map<string, MemberOption[]>();
    for (const member of members) {
      const primaryRole = member.role ?? "member";
      const list = map.get(primaryRole) ?? [];
      list.push(member);
      map.set(primaryRole, list);
    }
    const orderedRoles = [...ROLES];
    return orderedRoles
      .map((role) => [role, map.get(role) ?? []] as const)
      .filter(([, list]) => list.length > 0);
  }, [members]);

  const selectedSet = useMemo(() => new Set(selectedInvitees), [selectedInvitees]);

  const handleInviteeCheckedChange = useCallback((memberId: string, checked: CheckedState) => {
    setSelectedInvitees((prev) => {
      const set = new Set(prev);
      if (checked === true) {
        set.add(memberId);
      } else {
        set.delete(memberId);
      }
      return Array.from(set);
    });
  }, []);

  const handleDeadlineChange = useCallback((value: RegistrationDeadlineOption) => {
    setDeadlineOption(value);
  }, []);

  const fetchBlockedForDate = useCallback(
    async (dateValue: string) => {
      setIsCheckingBlocks(true);
      try {
        const response = await fetch(`/api/rehearsals/blocked?date=${dateValue}`);
        if (!response.ok) {
          throw new Error("Request failed");
        }
        const data = (await response.json()) as { userIds?: string[] };
        setBlockedUserIds(new Set(data.userIds ?? []));
      } catch (error) {
        console.error("Failed to load blocked members", error);
        toast.error("Sperrtermine konnten nicht geladen werden.");
      } finally {
        setIsCheckingBlocks(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchBlockedForDate(date).catch(() => null);
  }, [date, fetchBlockedForDate]);

  const skipInitialSave = useRef(true);

  useEffect(() => {
    if (skipInitialSave.current) {
      skipInitialSave.current = false;
      return;
    }

    setSaveStatus("saving");
    const handle = setTimeout(() => {
      const updateAction = isDraft ? updateRehearsalDraftAction : updateRehearsalAction;
      const actionParams = {
        id: rehearsal.id,
        title,
        date,
        time,
        location,
        description,
        invitees: selectedInvitees,
        registrationDeadlineOption: deadlineOption,
      };

      updateAction(actionParams)
        .then((result) => {
          if (result?.success) {
            setSaveStatus("saved");
            setLastSavedAt(new Date());
          } else {
            setSaveStatus("error");
            const errorMessage = isDraft
              ? "Entwurf konnte nicht gespeichert werden."
              : "Probe konnte nicht aktualisiert werden.";
            toast.error(result?.error ?? errorMessage);
          }
        })
        .catch(() => {
          setSaveStatus("error");
          const errorMessage = isDraft
            ? "Entwurf konnte nicht gespeichert werden."
            : "Probe konnte nicht aktualisiert werden.";
          toast.error(errorMessage);
        });
    }, 800);

    return () => clearTimeout(handle);
  }, [
    description,
    date,
    time,
    title,
    location,
    selectedInvitees,
    deadlineOption,
    rehearsal.id,
    isDraft,
  ]);

  const handlePublish = () => {
    startPublish(() => {
      publishRehearsalAction({
        id: rehearsal.id,
        title,
        date,
        time,
        location,
        description,
        invitees: selectedInvitees,
        registrationDeadlineOption: deadlineOption,
      })
        .then((result) => {
          if (result?.success && result.id) {
            toast.success("Probe veröffentlicht. Einladungen wurden versendet.");
            router.push(`/mitglieder/proben/${result.id}`);
          } else {
            toast.error(result?.error ?? "Probe konnte nicht veröffentlicht werden.");
          }
        })
        .catch(() => {
          toast.error("Probe konnte nicht veröffentlicht werden.");
        });
    });
  };

  const handleDiscard = () => {
    if (!confirm("Möchtest du diesen Entwurf wirklich verwerfen?")) {
      return;
    }
    startDiscard(() => {
      discardRehearsalDraftAction({ id: rehearsal.id })
        .then((result) => {
          if (result?.success) {
            toast.success("Entwurf verworfen.");
            router.push("/mitglieder/probenplanung");
          } else {
            toast.error(result?.error ?? "Der Entwurf konnte nicht verworfen werden.");
          }
        })
        .catch(() => {
          toast.error("Der Entwurf konnte nicht verworfen werden.");
        });
    });
  };

  const saveLabel = useMemo(() => {
    const formattedTime = lastSavedAt?.toLocaleTimeString("de-DE");

    if (isDraft) {
      switch (saveStatus) {
        case "saving":
          return "Speichert…";
        case "saved":
          return formattedTime ? `Entwurf gespeichert (${formattedTime})` : "Entwurf gespeichert";
        case "error":
          return "Speichern fehlgeschlagen";
        default:
          return "Bereit";
      }
    }

    switch (saveStatus) {
      case "saving":
        return "Speichert Änderungen…";
      case "saved":
        return formattedTime ? `Änderungen gespeichert (${formattedTime})` : "Änderungen gespeichert";
      case "error":
        return "Speichern fehlgeschlagen";
      default:
        return "Änderungen werden automatisch gespeichert.";
    }
  }, [saveStatus, lastSavedAt, isDraft]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Allgemeine Informationen</CardTitle>
          <p className="text-sm text-muted-foreground">{saveLabel}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="rehearsal-title">
                Titel
              </label>
              <Input
                id="rehearsal-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                minLength={3}
                maxLength={120}
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="rehearsal-date">
                  Datum
                </label>
                <Input
                  id="rehearsal-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="rehearsal-time">
                  Uhrzeit
                </label>
                <Input
                  id="rehearsal-time"
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="rehearsal-deadline">
                Rückmeldefrist
              </label>
              <Select
                value={deadlineOption}
                onValueChange={(value) => handleDeadlineChange(value as RegistrationDeadlineOption)}
              >
                <SelectTrigger id="rehearsal-deadline">
                  <SelectValue placeholder="Rückmeldefrist wählen" />
                </SelectTrigger>
                <SelectContent>
                  {REGISTRATION_DEADLINE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{deadlinePreviewText}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="rehearsal-location">
                Ort
              </label>
              <Input
                id="rehearsal-location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="z. B. Probenraum"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Beschreibung</label>
              <RichTextEditor value={description} onChange={setDescription} placeholder="Beschreibe Ablauf, Ziele oder Materialien." />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Teilnehmer auswählen</CardTitle>
          <p className="text-sm text-muted-foreground">
            Wähle aus, wer zur Probe eingeladen werden soll. Gesperrte Personen sind entsprechend gekennzeichnet.
            {isCheckingBlocks ? " (aktualisiere…)" : null}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {groupedMembers.map(([role, list]) => (
              <section key={role} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-foreground/90">{ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role}</h4>
                  <Badge variant="outline">{list.length}</Badge>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {list.map((member) => {
                    const isSelected = selectedSet.has(member.id);
                    const isBlocked = blockedUserIds.has(member.id);
                    const extraRoles = Array.from(new Set(member.extraRoles)).filter((extra) => extra !== member.role);

                    return (
                      <Label
                        key={member.id}
                        htmlFor={`invitee-${member.id}`}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-lg border bg-background/70 px-3 py-3 text-sm shadow-sm transition",
                          isSelected ? "border-primary/70 ring-1 ring-primary/40" : "border-border/60 hover:border-primary/40",
                        )}
                      >
                        <Checkbox
                          id={`invitee-${member.id}`}
                          className="mt-1"
                          checked={isSelected}
                          onCheckedChange={(checked) => handleInviteeCheckedChange(member.id, checked)}
                        />
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-foreground">{displayName(member)}</span>
                            {isBlocked && <Badge variant="destructive">gesperrt</Badge>}
                          </div>
                          {member.email && (
                            <p className="text-xs text-muted-foreground">{member.email}</p>
                          )}
                          {extraRoles.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {extraRoles.map((roleKey) => (
                                <Badge key={roleKey} variant="outline" className="text-[10px]">
                                  {ROLE_LABELS[roleKey as keyof typeof ROLE_LABELS] ?? roleKey}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </Label>
                    );
                  })}
                </div>
              </section>
            ))}
            {!groupedMembers.length && (
              <p className="text-sm text-muted-foreground">Es wurden keine Mitglieder gefunden.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-between">
        {isDraft ? (
          <>
            <Button type="button" variant="outline" onClick={handleDiscard} disabled={isDiscarding}>
              {isDiscarding ? "Verwerfe Entwurf…" : "Entwurf verwerfen"}
            </Button>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
              <div className="text-xs text-muted-foreground">
                Du kannst die Probe veröffentlichen, sobald alle Informationen vollständig sind.
              </div>
              <Button
                type="button"
                onClick={handlePublish}
                disabled={isPublishing || !selectedInvitees.length}
              >
                {isPublishing ? "Veröffentliche…" : "Probe veröffentlichen"}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3 md:ml-auto">
            <div className="text-xs text-muted-foreground">
              Änderungen werden automatisch gespeichert. Alle Teilnehmer erhalten Benachrichtigungen über Updates.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
