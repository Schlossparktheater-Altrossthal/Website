import { describe, expect, it, vi } from "vitest";

// Die reinen Funktionen brauchen keine Datenbank; der Import zieht aber `prisma` mit.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  buildReminderCandidates,
  isReminderDue,
  resolveReferenceAt,
  type ReminderCandidate,
  type ReminderEvent,
  type ReminderSnapshot,
} from "../event-reminders";
import type { EventReminderLead } from "../preferences";

const START = new Date("2026-10-05T17:00:00+02:00");
/** Termintag laut `blockDayKey` (Europe/Berlin). */
const DAY = "2026-10-05";

function reminderEvent(overrides: Partial<ReminderEvent> = {}): ReminderEvent {
  return {
    id: "e1",
    title: "Probe",
    kind: "REHEARSAL",
    start: START,
    invites: [],
    audienceUserIds: [],
    ...overrides,
  };
}

function snapshot(overrides: Partial<ReminderSnapshot> = {}): ReminderSnapshot {
  return {
    events: [reminderEvent()],
    availabilityByDay: new Map(),
    leadByUser: new Map(),
    ...overrides,
  };
}

const invite = (userId: string, response: string | null, personalStart: Date | null = null) => ({
  userId,
  response,
  personalStart,
});

describe("resolveReferenceAt", () => {
  it("nimmt die persönliche Zeit, sonst den Terminbeginn", () => {
    const personal = new Date("2026-10-05T18:30:00+02:00");
    expect(resolveReferenceAt(START, personal)).toBe(personal);
    expect(resolveReferenceAt(START, null)).toBe(START);
  });
});

describe("buildReminderCandidates", () => {
  it("erinnert Beteiligte, aber niemanden mit Absage oder Notfall", () => {
    const candidates = buildReminderCandidates(
      snapshot({
        events: [
          reminderEvent({
            invites: [
              invite("zugesagt", "yes"),
              invite("offen", null),
              invite("vielleicht", "maybe"),
              invite("abgesagt", "no"),
              invite("notfall", "emergency"),
            ],
          }),
        ],
      }),
    );
    expect(candidates.map((candidate) => candidate.userId).sort()).toEqual([
      "offen",
      "vielleicht",
      "zugesagt",
    ]);
  });

  it("nimmt Gruppenteilnehmer auf, aber keine, die abgesagt haben", () => {
    const candidates = buildReminderCandidates(
      snapshot({
        events: [
          reminderEvent({
            invites: [invite("abgesagt", "no")],
            audienceUserIds: ["abgesagt", "dabei"],
          }),
        ],
      }),
    );
    expect(candidates.map((candidate) => candidate.userId)).toEqual(["dabei"]);
  });

  it("überspringt die Einstellung „Nie“", () => {
    const candidates = buildReminderCandidates(
      snapshot({
        events: [reminderEvent({ invites: [invite("aus", null), invite("an", null)] })],
        leadByUser: new Map<string, EventReminderLead>([["aus", "never"]]),
      }),
    );
    expect(candidates.map((candidate) => candidate.userId)).toEqual(["an"]);
    expect(candidates[0].lead).toBe("1d");
  });

  it("lässt Gesperrte aus und erinnert Eingeschränkte weiter", () => {
    const candidates = buildReminderCandidates(
      snapshot({
        events: [
          reminderEvent({
            invites: [invite("gesperrt", null), invite("eingeschraenkt", null)],
          }),
        ],
        availabilityByDay: new Map([[DAY, { gesperrt: "blocked", eingeschraenkt: "limited" }]]),
      }),
    );
    expect(candidates.map((candidate) => candidate.userId)).toEqual(["eingeschraenkt"]);
  });

  it("rechnet die Fälligkeit aus persönlicher Zeit bzw. Terminbeginn", () => {
    const personalStart = new Date("2026-10-05T18:30:00+02:00");
    const candidates = buildReminderCandidates(
      snapshot({
        events: [
          reminderEvent({
            invites: [invite("gestaffelt", "yes", personalStart), invite("regulaer", "yes")],
          }),
        ],
        leadByUser: new Map<string, EventReminderLead>([
          ["gestaffelt", "2h"],
          ["regulaer", "1d"],
        ]),
      }),
    );
    const [personal, regular] = candidates;
    expect(personal.referenceAt).toEqual(personalStart);
    expect(personal.remindAt).toEqual(new Date(personalStart.getTime() - 2 * 60 * 60 * 1000));
    expect(regular.referenceAt).toEqual(START);
    expect(regular.remindAt).toEqual(new Date(START.getTime() - 24 * 60 * 60 * 1000));
  });
});

describe("isReminderDue", () => {
  const candidate: ReminderCandidate = {
    eventId: "e1",
    title: "Probe",
    userId: "u1",
    referenceAt: START,
    remindAt: new Date(START.getTime() - 24 * 60 * 60 * 1000),
    lead: "1d",
  };

  it("sendet erst ab Fälligkeit und nicht mehr zum Termin selbst", () => {
    expect(isReminderDue(candidate, new Date(candidate.remindAt.getTime() - 1000))).toBe(false);
    expect(isReminderDue(candidate, candidate.remindAt)).toBe(true);
    expect(isReminderDue(candidate, new Date(START.getTime() - 1000))).toBe(true);
    expect(isReminderDue(candidate, START)).toBe(false);
  });
});
