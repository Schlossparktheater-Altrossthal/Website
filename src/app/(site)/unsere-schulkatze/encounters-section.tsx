"use client";

import { EyeOffIcon, SparklesIcon, Trash2Icon, Undo2Icon, UserRoundIcon } from "@/components/ui/action-icons";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import type { Role } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ActionDropdownMenu } from "@/components/ui/action-dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Heading, Text } from "@/components/ui/typography";

const STORAGE_KEY = "cat-memory-entries";
const MODERATION_STORAGE_KEY = "cat-memory-hidden";

const MODERATOR_ROLES = new Set<Role>(["board", "admin", "owner"]);

type CatMemoryEntry = {
  id: string;
  since: string;
  nickname: string;
  story: string;
  author?: string;
  createdAt?: string;
  source: "curated" | "user";
};

type StoredCatMemoryEntry = Omit<CatMemoryEntry, "source">;

const curatedCatMemoryEntries: CatMemoryEntry[] = [];

function generateMemoryId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `memory-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function CatMemorySection() {
  const { data: session } = useSession();
  const [userMemories, setUserMemories] = useState<CatMemoryEntry[]>([]);
  const [hiddenMemoryIds, setHiddenMemoryIds] = useState<string[]>([]);
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
      const parsed = JSON.parse(storedValue) as StoredCatMemoryEntry[];

      if (!Array.isArray(parsed)) {
        return;
      }

      const sanitized = parsed
        .filter(
          (entry): entry is StoredCatMemoryEntry =>
            typeof entry === "object" &&
            entry !== null &&
            typeof entry.since === "string" &&
            typeof entry.nickname === "string" &&
            typeof entry.story === "string"
        )
        .map((entry) => ({
          id: entry.id ?? generateMemoryId(),
          since: entry.since.trim(),
          nickname: entry.nickname.trim(),
          story: entry.story.trim(),
          author: entry.author?.trim() || undefined,
          createdAt: entry.createdAt,
          source: "user" as const,
        }));

      if (sanitized.length > 0) {
        setUserMemories(sanitized);
      }
    } catch {
      // Wenn Parsing fehlschlägt, ignorieren wir den lokalen Speicher und starten frisch.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (userMemories.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    const payload: StoredCatMemoryEntry[] = userMemories.map((entry) => {
      const { source: _source, ...rest } = entry;
      void _source;
      return rest;
    });
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [userMemories]);

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
        setHiddenMemoryIds(Array.from(new Set(sanitized)));
      }
    } catch {
      // Wenn Parsing fehlschlägt, ignorieren wir die Moderationsdaten.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (hiddenMemoryIds.length === 0) {
      window.localStorage.removeItem(MODERATION_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(MODERATION_STORAGE_KEY, JSON.stringify(hiddenMemoryIds));
  }, [hiddenMemoryIds]);

  const allCatMemoryEntries = useMemo(() => [...userMemories, ...curatedCatMemoryEntries], [userMemories]);

  const hiddenCatMemoryEntryIdSet = useMemo(() => new Set(hiddenMemoryIds), [hiddenMemoryIds]);

  const visibleCatMemoryEntries = useMemo(
    () => allCatMemoryEntries.filter((entry) => !hiddenCatMemoryEntryIdSet.has(entry.id)),
    [allCatMemoryEntries, hiddenCatMemoryEntryIdSet],
  );

  const archivedCatMemoryEntries = useMemo(
    () => allCatMemoryEntries.filter((entry) => hiddenCatMemoryEntryIdSet.has(entry.id)),
    [allCatMemoryEntries, hiddenCatMemoryEntryIdSet],
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

  const handleHideCatMemoryEntry = useCallback((entryId: string) => {
    setHiddenMemoryIds((previous) => {
      if (previous.includes(entryId)) {
        return previous;
      }
      return [...previous, entryId];
    });
    setShowModerationDetails(true);
  }, []);

  const handleRestoreCatMemoryEntry = useCallback((entryId: string) => {
    setHiddenMemoryIds((previous) => previous.filter((storedId) => storedId !== entryId));
  }, []);

  const handleDeleteCatMemoryEntry = useCallback((entryId: string) => {
    setUserMemories((previous) => previous.filter((entry) => entry.id !== entryId));
    setHiddenMemoryIds((previous) => previous.filter((storedId) => storedId !== entryId));
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

    const newCatMemoryEntry: CatMemoryEntry = {
      id: generateMemoryId(),
      since,
      nickname,
      story,
      author: author || undefined,
      createdAt,
      source: "user",
    };

    setUserMemories((previous) => [newCatMemoryEntry, ...previous]);
    form.reset();

    const sinceInput = form.querySelector<HTMLInputElement>("#cat-memory-since");
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
              Begegnungen mit Dennis Dieter von Altroßthal
            </Heading>
            <Text variant="body" tone="muted" align="center">
              Seit wann kennen Sie schon Dennis Dieter von Altroßthal? Welchen Spitznamen hat er bei Ihnen? Teilen Sie uns Ihre Begegnung
              mit Dennis Dieter mit. Wir freuen uns, mehr darüber zu erfahren.
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
                  Ein Klick öffnet das Formular.
                </Text>
                <Button
                  type="button"
                  size="sm"
                  variant={isFormOpen ? "outline" : "primary"}
                  className="rounded-full px-4"
                  onClick={toggleFormVisibility}
                  aria-expanded={isFormOpen}
                  aria-controls="cat-memory-form"
                >
                  <SparklesIcon className="h-4 w-4" aria-hidden />
                  {isFormOpen ? "Formular schließen" : "Begegnung eintragen"}
                </Button>
              </div>

              {isFormOpen ? (
                <form
                  id="cat-memory-form"
                  className="mt-6 space-y-4"
                  onSubmit={handleSubmit}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="cat-memory-since">Seit wann kennen Sie Dennis Dieter?</Label>
                      <Input id="cat-memory-since" name="since" placeholder="z. B. Frühjahr 2024" required autoComplete="off" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cat-memory-nickname">Wie hieß er bei Ihnen?</Label>
                      <Input
                        id="cat-memory-nickname"
                        name="nickname"
                        placeholder="Unser Spitzname für Dennis Dieter"
                        required
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cat-memory-author">Wer teilt diese Begegnung? (optional)</Label>
                    <Input
                      id="cat-memory-author"
                      name="author"
                      placeholder="Ihr Name, Ihre Klasse oder Gruppe"
                      autoComplete="off"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="cat-memory-story">Ihre Begegnung mit Dennis Dieter</Label>
                    <Textarea
                      id="cat-memory-story"
                      name="story"
                      placeholder="Was haben Sie mit Dennis Dieter erlebt?"
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
                  {visibleCatMemoryEntries.length > 0 ? (
                    visibleCatMemoryEntries.map((entry) => {
                      const isUserEntry = entry.source === "user";
                      const moderationItems = canModerate
                        ? [
                            {
                              label: "Beitrag ausblenden",
                              icon: <EyeOffIcon className="h-4 w-4" aria-hidden />,
                              onClick: () => handleHideCatMemoryEntry(entry.id),
                            },
                            ...(isUserEntry
                              ? [
                                  {
                                    label: "Beitrag löschen (lokal)",
                                    icon: <Trash2Icon className="h-4 w-4" aria-hidden />,
                                    onClick: () => handleDeleteCatMemoryEntry(entry.id),
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
                              <UserRoundIcon className="h-4 w-4" aria-hidden />
                            ) : (
                              <SparklesIcon className="h-4 w-4" aria-hidden />
                            )}
                          </span>

                          <Card className="group relative space-y-3 rounded-2xl border border-border/50 bg-background/75 p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl sm:p-5">
                            {canModerate ? (
                              <ActionDropdownMenu items={moderationItems} className="absolute right-4 top-4" />
                            ) : null}

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
                                onClick={() => handleDeleteCatMemoryEntry(entry.id)}
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
                          Seien Sie die erste Person, die Dennis Dieter hier vorstellt.
                        </Text>
                      </Card>
                    </li>
                  )}
                </ul>
              </div>

              {canModerate && archivedCatMemoryEntries.length > 0 ? (
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
                        : `Anzeigen (${archivedCatMemoryEntries.length})`}
                    </Button>
                  </div>

                  {showModerationDetails ? (
                    <div className="mt-4 space-y-3">
                      {archivedCatMemoryEntries.map((entry) => (
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
                            onClick={() => handleRestoreCatMemoryEntry(entry.id)}
                          >
                            <Undo2Icon className="mr-2 h-4 w-4" aria-hidden />
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
