"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Heading, Text } from "@/components/ui/typography";

const STORAGE_KEY = "dieter-dennis-encounters";

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
  const [userEncounters, setUserEncounters] = useState<Encounter[]>([]);

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

  const encounters = [...userEncounters, ...curatedEncounters];

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
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
  }

  return (
    <section className="layout-container pb-24">
      <div className="mx-auto max-w-5xl space-y-10">
        <div className="space-y-4 text-center">
          <Heading level="h2" align="center">
            Begegnungen mit Dieter Dennis von Altroßthal
          </Heading>
          <Text variant="body" tone="muted" align="center">
            Seit wann kennen Sie schon Dieter Dennis von Altroßthal? Wie hieß sie bei Ihnen? Teilen Sie uns Ihre Begegnung mit
            Dieter mit. Wir freuen uns mehr über sie zu erfahren.
          </Text>
        </div>

        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="space-y-6 p-6 sm:p-8">
            <div className="space-y-2">
              <Heading level="h3" className="text-lg sm:text-xl">
                Begegnung teilen
              </Heading>
              <Text variant="small" tone="muted">
                Ihre Angaben erscheinen nach dem Absenden in der Übersicht. Pflichtfelder helfen uns, Ihre Geschichte einzuordnen.
              </Text>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dieter-since">Seit wann kennen Sie Dieter?</Label>
                  <Input id="dieter-since" name="since" placeholder="z. B. Frühjahr 2020" required autoComplete="off" />
                </div>
                <div className="space-y-2">
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

              <div className="space-y-2">
                <Label htmlFor="dieter-author">Wer teilt diese Begegnung? (optional)</Label>
                <Input
                  id="dieter-author"
                  name="author"
                  placeholder="Ihr Name, Ihre Klasse oder Gruppe"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dieter-story">Ihre Begegnung mit Dieter</Label>
                <Textarea
                  id="dieter-story"
                  name="story"
                  placeholder="Was haben Sie mit Dieter erlebt?"
                  rows={5}
                  required
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Text variant="caption" tone="muted">
                  Mit dem Absenden stimmen Sie einer Veröffentlichung auf dieser Seite zu.
                </Text>
                <Button type="submit">Begegnung teilen</Button>
              </div>
            </form>
          </Card>

          <div className="space-y-4">
            <div>
              <Heading level="h3" className="text-lg sm:text-xl">
                Eure Begegnungen
              </Heading>
              <Text variant="small" tone="muted">
                Hier werden die Begegnungen gesammelt, so dass jede:r sie lesen kann.
              </Text>
            </div>

            <div className="space-y-4">
              {encounters.map((entry) => (
                <Card key={entry.id} className="space-y-3 p-5 sm:p-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Text weight="semibold" className="text-base sm:text-lg">
                      {entry.nickname}
                    </Text>
                    <Text variant="small" tone="muted">
                      {entry.source === "user" ? entry.createdAt ?? "soeben geteilt" : entry.createdAt ?? entry.since}
                    </Text>
                  </div>
                  <Text variant="small" tone="muted" weight="medium">
                    Seit {entry.since}
                  </Text>
                  <Text variant="body" className="text-sm leading-relaxed">
                    {entry.story}
                  </Text>
                  {entry.author ? (
                    <Text variant="small" tone="muted" className="italic">
                      — {entry.author}
                    </Text>
                  ) : null}
                </Card>
              ))}

              {encounters.length === 0 ? (
                <Card className="space-y-2 p-5 sm:p-6">
                  <Text weight="semibold">Noch keine Begegnungen</Text>
                  <Text variant="small" tone="muted">
                    Seien Sie die erste Person, die Dieter Dennis hier vorstellt.
                  </Text>
                </Card>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
