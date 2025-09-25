"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import type { Role } from "@prisma/client";
import { EyeOff, Sparkles, Trash2, Undo2, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Heading, Text } from "@/components/ui/typography";

const STORAGE_KEY = "dieter-dennis-encounters";
const MODERATION_STORAGE_KEY = "dieter-dennis-hidden-encounters";

const MODERATOR_ROLES = new Set<Role>(["board", "admin", "owner"]);

type Encounter = {
  id: string;
  since: string;
  nickname: string;
  story: string;
  author?: string;
  createdAt?: string;
  source: "curated" | "user";
};

type StoredEncounter = Omit<Encounter, "source">;

const curatedEncounters: Encounter[] = [
  {
    id: "curated-1",
    since: "Sommer 2019",
    nickname: "Direktor Dennis",
    story:
      "Bei der Generalprobe durfte Dieter auf der leeren Zuschauertribüne thronen. Sein zufriedenes Schnurren war das entspannteste Zeichen für eine gelungene Premiere.",
    author: "Lara aus der Kostümwerkstatt",
    createdAt: "Juni 2023",
    source: "curated",
  },
  {
    id: "curated-2",
    since: "Frühjahr 2016",
    nickname: "Professor Dieter",
    story:
      "In der Prüfungswoche spazierte er durch die Aula, legte sich mitten zwischen die Skripte und erinnerte uns daran, Pausen einzuplanen. Seitdem gehört ein Streicheln von Dieter zu jeder Lernrunde.",
    author: "Herr Schubert, Mathekollegium",
    createdAt: "März 2022",
    source: "curated",
  },
  {
    id: "curated-3",
    since: "Herbst 2021",
    nickname: "Captain Dennis",
    story:
      "Beim Kulissenbau für das Hafenstück bewachte er mit ernster Miene die Werkzeugkisten. Niemand vergaß dank ihm den Helm – Dieter passte einfach auf uns auf.",
    author: "Werkstatt-AG",
    createdAt: "Oktober 2023",
    source: "curated",
  },
];

function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `encounter-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function DieterEncountersSection() {
  const { data: session } = useSession();
  const [userEncounters, setUserEncounters] = useState<Encounter[]>([]);
  const [hiddenEncounterIds, setHiddenEncounterIds] = useState<string[]>([]);
  const [showModerationDetails, setShowModerationDetails] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedValue = window.localStorage.getItem(STORAGE_KEY);

    if (!storedValue) {
      return;
    }

    try {
      const parsed = JSON.parse(storedValue) as StoredEncounter[];

      if (!Array.isArray(parsed)) {
        return;
      }

      const sanitized = parsed
        .filter(
          (entry): entry is StoredEncounter =>
            typeof entry === "object" &&
            entry !== null &&
            typeof entry.since === "string" &&
            typeof entry.nickname === "string" &&
            typeof entry.story === "string"
        )
        .map((entry) => ({
          id: entry.id ?? generateId(),
          since: entry.since.trim(),
          nickname: entry.nickname.trim(),
          story: entry.story.trim(),
          author: entry.author?.trim() || undefined,
          createdAt: entry.createdAt,
          source: "user" as const,
        }));

      if (sanitized.length > 0) {
        setUserEncounters(sanitized);
      }
    } catch {
      // Wenn Parsing fehlschlägt, ignorieren wir den lokalen Speicher und starten frisch.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (userEncounters.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    const payload: StoredEncounter[] = userEncounters.map((entry) => {
      const { source: _source, ...rest } = entry;
      void _source;
      return rest;
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [userEncounters]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedValue = window.localStorage.getItem(MODERATION_STORAGE_KEY);

    if (!storedValue) {
      return;
    }

    try {
      const parsed = JSON.parse(storedValue);

      if (!Array.isArray(parsed)) {
        return;
      }

      const sanitized = parsed.filter((value): value is string => typeof value === "string" && value.trim().length > 0);

      if (sanitized.length > 0) {
        setHiddenEncounterIds(Array.from(new Set(sanitized)));
      }
    } catch {
      // Wenn Parsing fehlschlägt, ignorieren wir die Moderationsdaten.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (hiddenEncounterIds.length === 0) {
      window.localStorage.removeItem(MODERATION_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(MODERATION_STORAGE_KEY, JSON.stringify(hiddenEncounterIds));
  }, [hiddenEncounterIds]);

  const allEncounters = useMemo(() => [...userEncounters, ...curatedEncounters], [userEncounters]);

  const hiddenEncounterIdSet = useMemo(() => new Set(hiddenEncounterIds), [hiddenEncounterIds]);

  const visibleEncounters = useMemo(
    () => allEncounters.filter((entry) => !hiddenEncounterIdSet.has(entry.id)),
    [allEncounters, hiddenEncounterIdSet],
  );

  const archivedEncounters = useMemo(
    () => allEncounters.filter((entry) => hiddenEncounterIdSet.has(entry.id)),
    [allEncounters, hiddenEncounterIdSet],
  );

  const userRoles = useMemo(() => {
    const collected = new Set<Role>();
    const primaryRole = session?.user?.role;
    const extraRoles = session?.user?.roles;

    if (primaryRole) {
      collected.add(primaryRole);
    }

    if (Array.isArray(extraRoles)) {
      for (const role of extraRoles) {
        collected.add(role);
      }
    }

    return Array.from(collected);
  }, [session?.user?.role, session?.user?.roles]);

  const canModerate = userRoles.some((role) => MODERATOR_ROLES.has(role));

  useEffect(() => {
    if (!canModerate) {
      setShowModerationDetails(false);
    }
  }, [canModerate]);

  const handleHideEncounter = useCallback((entryId: string) => {
    setHiddenEncounterIds((previous) => {
      if (previous.includes(entryId)) {
        return previous;
      }
      return [...previous, entryId];
    });
    setShowModerationDetails(true);
  }, []);

  const handleRestoreEncounter = useCallback((entryId: string) => {
    setHiddenEncounterIds((previous) => previous.filter((storedId) => storedId !== entryId));
  }, []);

  const handleDeleteEncounter = useCallback((entryId: string) => {
    setUserEncounters((previous) => previous.filter((entry) => entry.id !== entryId));
    setHiddenEncounterIds((previous) => previous.filter((storedId) => storedId !== entryId));
  }, []);

  const toggleFormVisibility = useCallback(() => {
    setIsFormOpen((previous) => !previous);
  }, []);

  const handleSubmit = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    const since = ((formData.get("since") as string | null) ?? "").trim();
    const nickname = ((formData.get("nickname") as string | null) ?? "").trim();
    const story = ((formData.get("story") as string | null) ?? "").trim();
    const author = ((formData.get("author") as string | null) ?? "").trim();

    if (!since || !nickname || !story) {
      return;
    }

    const createdAt =
      typeof Intl !== "undefined"
        ? new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(new Date())
        : undefined;

    const newEncounter: Encounter = {
      id: generateId(),
      since,
      nickname,
      story,
      author: author || undefined,
      createdAt,
      source: "user",
    };

    setUserEncounters((previous) => [newEncounter, ...previous]);
    form.reset();

    const sinceInput = form.querySelector<HTMLInputElement>("#dieter-since");
    sinceInput?.focus();
  }, []);

  return (
    <section className="relative isolate overflow-hidden bg-muted/30 py-20 sm:py-24">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute left-1/2 top-[-14rem] h-[28rem] w-[120vw] -translate-x-1/2 rounded-full bg-gradient-to-r from-primary/25 via-primary/10 to-transparent opacity-70 blur-3xl"
          aria-hidden
        />
        <div
          className="absolute right-[-18vw] bottom-[-10rem] h-[26rem] w-[80vw] rounded-full bg-gradient-to-br from-primary/20 via-primary/8 to-transparent opacity-60 blur-3xl"
          aria-hidden
        />
      </div>

      <div className="layout-container">
        <div className="mx-auto max-w-6xl space-y-10">
          <div className="space-y-4 text-center">
            <Heading level="h2" align="center">
              Begegnungen mit Dieter Dennis von Altroßthal
            </Heading>
            <Text variant="body" tone="muted" align="center">
              Seit wann kennen Sie schon Dieter Dennis von Altroßthal? Wie hieß sie bei Ihnen? Teilen Sie uns Ihre Begegnung mit
              Dieter mit. Wir freuen uns mehr über sie zu erfahren.
            </Text>
          </div>

          <div className="flex flex-col gap-8 lg:gap-10">
            <Card className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-[1.75rem] border border-border/50 bg-background/80 p-6 shadow-xl backdrop-blur-sm sm:p-7">
              <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
                <div
                  className="absolute left-1/2 top-[-5rem] h-[18rem] w-[24rem] -translate-x-1/2 rounded-full bg-primary/15 opacity-70 blur-3xl"
                  aria-hidden
                />
                <div
                  className="absolute right-[-8rem] bottom-[-8rem] h-[16rem] w-[16rem] rounded-full bg-primary/10 opacity-60 blur-3xl"
                  aria-hidden
                />
              </div>

              <div className="space-y-4">
                <Badge className="w-fit rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
                  Erinnerung teilen
                </Badge>
                <div className="space-y-2">
                  <Heading level="h3" className="text-xl">
                    Begegnung teilen
                  </Heading>
                  <Text variant="small" tone="muted">
                    Ihre Angaben erscheinen nach dem Absenden sofort in der Übersicht. Pflichtfelder helfen uns, Ihre Geschichte
                    einzuordnen und den Überblick zu behalten.
                  </Text>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Text variant="small" tone="muted">
                  Ein Klick öffnet das Formular – so bleibt die Übersicht konzentriert und leicht.
                </Text>
                <Button
                  type="button"
                  size="sm"
                  variant={isFormOpen ? "outline" : "primary"}
                  className="rounded-full px-4"
                  onClick={toggleFormVisibility}
                  aria-expanded={isFormOpen}
                  aria-controls="dieter-encounter-form"
                >
                  <Sparkles className="h-4 w-4" aria-hidden />
                  {isFormOpen ? "Formular schließen" : "Begegnung eintragen"}
                </Button>
              </div>

              {isFormOpen ? (
                <form
                  id="dieter-encounter-form"
                  className="mt-5 space-y-5 rounded-2xl border border-border/40 bg-background/70 p-4 shadow-inner sm:p-5"
                  onSubmit={handleSubmit}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="dieter-since">Seit wann kennen Sie Dieter?</Label>
                      <Input id="dieter-since" name="since" placeholder="z. B. Frühjahr 2020" required autoComplete="off" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="dieter-nickname">Wie hieß sie bei Ihnen?</Label>
                      <Input
                        id="dieter-nickname"
                        name="nickname"
                        placeholder="Unser Spitzname für Dieter"
                        required
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="dieter-author">Wer teilt diese Begegnung? (optional)</Label>
                    <Input
                      id="dieter-author"
                      name="author"
                      placeholder="Ihr Name, Ihre Klasse oder Gruppe"
                      autoComplete="off"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="dieter-story">Ihre Begegnung mit Dieter</Label>
                    <Textarea
                      id="dieter-story"
                      name="story"
                      placeholder="Was haben Sie mit Dieter erlebt?"
                      rows={5}
                      required
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-3">
                    <Text variant="caption" tone="muted" className="max-w-[24rem] text-left">
                      Mit dem Absenden stimmen Sie einer Veröffentlichung auf dieser Seite zu.
                    </Text>
                    <Button type="submit" size="sm" className="rounded-full px-4">
                      Begegnung teilen
                    </Button>
                  </div>
                </form>
              ) : null}
            </Card>

            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <Heading level="h3" className="text-lg sm:text-xl">
                    Eure Begegnungen
                  </Heading>
                  <Text variant="small" tone="muted">
                    Hier sammeln wir alle Erinnerungen – neue Beiträge erscheinen sofort nach dem Absenden.
                  </Text>
                </div>
                {canModerate ? (
                  <Badge size="sm" className="self-start rounded-full border border-info/30 bg-info/10 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-info">
                    Moderation aktiv
                  </Badge>
                ) : null}
              </div>

              <div className="relative pl-2 sm:pl-3">
                <div
                  className="pointer-events-none absolute left-[1.25rem] top-3 bottom-5 w-px bg-gradient-to-b from-primary/30 via-border/50 to-transparent sm:left-[1.5rem]"
                  aria-hidden
                />

                <ul className="space-y-5">
                  {visibleEncounters.length > 0 ? (
                    visibleEncounters.map((entry) => {
                      const isUserEntry = entry.source === "user";
                      const moderationItems = canModerate
                        ? [
                            {
                              label: "Beitrag ausblenden",
                              icon: <EyeOff className="h-4 w-4" aria-hidden />,
                              onClick: () => handleHideEncounter(entry.id),
                            },
                            ...(isUserEntry
                              ? [
                                  {
                                    label: "Beitrag löschen (lokal)",
                                    icon: <Trash2 className="h-4 w-4" aria-hidden />,
                                    onClick: () => handleDeleteEncounter(entry.id),
                                    variant: "destructive" as const,
                                  },
                                ]
                              : []),
                          ]
                        : [];

                      return (
                        <li key={entry.id} className="relative pl-11 sm:pl-12">
                          <span
                            className="absolute left-0 top-1 flex h-9 w-9 items-center justify-center rounded-full border border-border/50 bg-background/80 text-primary shadow-sm backdrop-blur"
                            aria-hidden
                          >
                            {isUserEntry ? (
                              <UserRound className="h-4 w-4" aria-hidden />
                            ) : (
                              <Sparkles className="h-4 w-4" aria-hidden />
                            )}
                          </span>

                          <Card className="group relative space-y-3 rounded-2xl border border-border/50 bg-background/75 p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl sm:p-5">
                            {canModerate ? <DropdownMenu items={moderationItems} className="absolute right-4 top-4" /> : null}

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="flex flex-wrap items-center gap-3">
                                <Text weight="semibold" className="text-base sm:text-lg">
                                  {entry.nickname}
                                </Text>
                                <Badge
                                  size="sm"
                                  className="rounded-full px-3 text-[10px] font-semibold uppercase tracking-[0.18em]"
                                  variant={isUserEntry ? "info" : "muted"}
                                >
                                  {isUserEntry ? "Community" : "Aus dem Archiv"}
                                </Badge>
                              </div>
                              <Text variant="small" tone="muted">
                                {entry.createdAt ?? entry.since}
                              </Text>
                            </div>

                            <Text variant="small" tone="muted" weight="medium">
                              Seit {entry.since}
                            </Text>
                            <Text className="whitespace-pre-line text-sm leading-7 text-foreground/90">{entry.story}</Text>
                            {entry.author ? (
                              <Text variant="small" tone="muted" className="italic">
                                — {entry.author}
                              </Text>
                            ) : null}

                            {isUserEntry ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteEncounter(entry.id)}
                                className="text-[11px] font-medium text-muted-foreground underline-offset-2 transition hover:text-destructive hover:underline focus-visible:outline-none"
                              >
                                Beitrag auf diesem Gerät entfernen
                              </button>
                            ) : null}
                          </Card>
                        </li>
                      );
                    })
                  ) : (
                    <li>
                      <Card className="rounded-2xl border border-dashed border-border/60 bg-background/60 p-5 text-center shadow-none">
                        <Text weight="semibold" className="text-sm">
                          Noch keine Begegnungen
                        </Text>
                        <Text variant="small" tone="muted">
                          Seien Sie die erste Person, die Dieter Dennis hier vorstellt.
                        </Text>
                      </Card>
                    </li>
                  )}
                </ul>
              </div>

              {canModerate && archivedEncounters.length > 0 ? (
                <Card className="rounded-2xl border border-dashed border-primary/35 bg-primary/5 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <Text weight="semibold">Ausgeblendete Begegnungen</Text>
                      <Text variant="small" tone="muted">
                        Nur für Moderatoren sichtbar. Blenden Sie Beiträge bei Bedarf wieder ein.
                      </Text>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowModerationDetails((previous) => !previous)}
                    >
                      {showModerationDetails
                        ? "Verbergen"
                        : `Anzeigen (${archivedEncounters.length})`}
                    </Button>
                  </div>

                  {showModerationDetails ? (
                    <div className="mt-4 space-y-3">
                      {archivedEncounters.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex flex-col gap-2 rounded-2xl border border-border/40 bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <Text weight="medium" className="text-sm">
                              {entry.nickname}
                            </Text>
                            <Text variant="small" tone="muted">
                              Seit {entry.since}
                            </Text>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="self-start text-primary hover:text-primary focus-visible:ring-primary/30"
                            onClick={() => handleRestoreEncounter(entry.id)}
                          >
                            <Undo2 className="mr-2 h-4 w-4" aria-hidden />
                            Wiederherstellen
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </Card>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
