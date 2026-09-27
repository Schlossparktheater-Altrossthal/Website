"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AsyncButton } from "@/components/ui/async-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { SegmentedControl } from "@/components/ui/segmented-control";

import { saveRehearsalReviewAction } from "./actions/review";

type Outcome = "DONE" | "PARTIAL" | "SKIPPED";

export type ReviewScene = { sceneId: string; label: string; outcome: Outcome | null };
export type ReviewPerson = {
  userId: string;
  name: string;
  declined: boolean;
  attended: boolean | null;
};

const OUTCOME_OPTIONS = [
  { value: "DONE" as const, label: "Geschafft" },
  { value: "PARTIAL" as const, label: "Teilweise" },
  { value: "SKIPPED" as const, label: "Nicht" },
];

/** Nach der Probe: Szenen abhaken und Anwesenheit erfassen. */
export function RehearsalReview({
  eventId,
  scenes: initialScenes,
  people: initialPeople,
}: {
  eventId: string;
  scenes: ReviewScene[];
  people: ReviewPerson[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [scenes, setScenes] = useState(initialScenes);
  // Ohne Erfassung: wer nicht abgesagt hat, gilt als anwesend.
  const [present, setPresent] = useState(
    () =>
      new Set(
        initialPeople
          .filter((person) => person.attended ?? !person.declined)
          .map((person) => person.userId),
      ),
  );

  const save = () =>
    startTransition(async () => {
      const result = await saveRehearsalReviewAction({
        eventId,
        scenes: scenes.map(({ sceneId, outcome }) => ({ sceneId, outcome: outcome ?? "DONE" })),
        attendance: initialPeople.map((person) => ({
          userId: person.userId,
          attended: present.has(person.userId),
        })),
      });
      if (!result.ok) {
        toast.error("Nicht gespeichert", { description: result.error, duration: 5000 });
        return;
      }
      toast.success("Nachbereitung gespeichert", { duration: 3000 });
      router.refresh();
    });

  const togglePresent = (userId: string) =>
    setPresent((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nachbereitung</CardTitle>
        <p className="text-sm text-muted-foreground">
          Was geschafft wurde, fließt in den Probenzähler der Szenen ein.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {scenes.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {scenes.map((scene) => (
              <li
                key={scene.sceneId}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-sm font-medium">{scene.label}</span>
                <SegmentedControl
                  value={scene.outcome ?? "DONE"}
                  onValueChange={(outcome) =>
                    setScenes((current) =>
                      current.map((entry) =>
                        entry.sceneId === scene.sceneId ? { ...entry, outcome } : entry,
                      ),
                    )
                  }
                  options={OUTCOME_OPTIONS}
                  fullWidth
                  className="sm:w-auto"
                  aria-label={`Ergebnis ${scene.label}`}
                />
              </li>
            ))}
          </ul>
        ) : null}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">
            Anwesend ({present.size} von {initialPeople.length})
          </h3>
          <ul className="grid gap-1 sm:grid-cols-2">
            {initialPeople.map((person) => (
              <li key={person.userId}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-muted">
                  <Checkbox
                    checked={present.has(person.userId)}
                    onCheckedChange={() => togglePresent(person.userId)}
                  />
                  <span className="text-sm">
                    {person.name}
                    {person.declined ? (
                      <span className="text-xs text-muted-foreground"> · hatte abgesagt</span>
                    ) : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <AsyncButton type="button" isLoading={pending} loadingText="Speichert…" onClick={save}>
          Nachbereitung speichern
        </AsyncButton>
      </CardContent>
    </Card>
  );
}
