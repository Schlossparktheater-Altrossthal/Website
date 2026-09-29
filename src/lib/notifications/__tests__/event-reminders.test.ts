import { beforeEach, describe, expect, it, vi } from "vitest";

/** Minimales Datenbank-Double für Leser und Versand-Protokoll. */
const db = vi.hoisted(() => ({
  dispatches: [] as { eventId: string; userId: string; lead: string }[],
  calendarEvent: { findMany: vi.fn() },
  departmentMembership: { findMany: vi.fn() },
  productionMembership: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
  notificationSettings: { findMany: vi.fn() },
  eventReminderDispatch: { findMany: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
}));

const notifyMock = vi.hoisted(() => vi.fn<(input: NotifyInput) => Promise<void>>());

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/calendar/day-availability", () => ({
  readDayAvailability: vi.fn(async () => ({})),
}));
vi.mock("../notify", () => ({ notify: notifyMock }));

import {
  buildReminderCandidates,
  dispatchEventReminders,
  isReminderDue,
  resolveReferenceAt,
  type ReminderCandidate,
  type ReminderEvent,
  type ReminderSnapshot,
} from "../event-reminders";
import type { NotifyInput } from "../notify";
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
    allDay: false,
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

describe("dispatchEventReminders", () => {
  const NOW = new Date(START.getTime() - 20 * 60 * 60 * 1000);

  beforeEach(() => {
    db.dispatches.length = 0;
    notifyMock.mockReset().mockResolvedValue(undefined);
    db.calendarEvent.findMany.mockReset().mockResolvedValue([
      {
        id: "e1",
        title: "Probe",
        kind: "REHEARSAL",
        start: START,
        allDay: false,
        showId: null,
        departmentId: null,
        audienceRules: [],
        participants: [
          { userId: "u1", response: "yes", personalStart: null },
          { userId: "u2", response: null, personalStart: null },
        ],
      },
    ]);
    db.departmentMembership.findMany.mockReset().mockResolvedValue([]);
    db.productionMembership.findMany.mockReset().mockResolvedValue([]);
    db.user.findMany.mockReset().mockResolvedValue([]);
    db.notificationSettings.findMany
      .mockReset()
      .mockResolvedValue([{ userId: "u1", reminderLead: "1d" }]);
    db.eventReminderDispatch.findMany
      .mockReset()
      .mockImplementation(async () => [...db.dispatches]);
    db.eventReminderDispatch.createMany
      .mockReset()
      .mockImplementation(
        async ({ data }: { data: { eventId: string; userId: string; lead: string }[] }) => {
          for (const row of data) {
            const known = db.dispatches.some(
              (entry) => entry.eventId === row.eventId && entry.userId === row.userId,
            );
            if (!known) db.dispatches.push({ ...row });
          }
          return { count: data.length };
        },
      );
    db.eventReminderDispatch.deleteMany
      .mockReset()
      .mockImplementation(
        async ({ where }: { where: { eventId: string; userId: { in: string[] } } }) => {
          const keep = db.dispatches.filter(
            (entry) => entry.eventId !== where.eventId || !where.userId.in.includes(entry.userId),
          );
          db.dispatches.length = 0;
          db.dispatches.push(...keep);
          return { count: 0 };
        },
      );
  });

  it("sendet fällige Erinnerungen und schickt sie beim zweiten Lauf nicht erneut", async () => {
    const first = await dispatchEventReminders({ now: NOW });
    expect(first).toEqual({ sent: 2, skipped: 0, failed: 0 });
    expect(db.dispatches).toHaveLength(2);
    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock.mock.calls[0][0]).toMatchObject({
      type: "event-reminder",
      recipients: ["u1", "u2"],
      title: "Erinnerung: Probe",
      eventId: "e1",
      category: "proben",
      groupKey: "reminder:e1",
    });

    const second = await dispatchEventReminders({ now: NOW });
    expect(second).toEqual({ sent: 0, skipped: 2, failed: 0 });
    expect(notifyMock).toHaveBeenCalledTimes(1);
  });

  it("nimmt das Protokoll zurück, wenn der Versand scheitert", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    notifyMock.mockRejectedValue(new Error("kaputt"));
    const result = await dispatchEventReminders({ now: NOW });
    expect(result).toEqual({ sent: 0, skipped: 0, failed: 2 });
    expect(db.dispatches).toHaveLength(0);
    quiet.mockRestore();
  });
});
