import { prisma } from "@/lib/prisma";
import type { HomepageCountdown } from "@prisma/client";

export const HOMEPAGE_COUNTDOWN_ID = "public";
export const DEFAULT_HOMEPAGE_COUNTDOWN_ISO = "2026-06-18T17:00:00.000Z";

export type HomepageCountdownRecord = HomepageCountdown | null;

export type HomepageCountdownTermin = { datum: string; uhrzeit: string; label?: string };

function getDefaultCountdownDate() {
  return new Date(DEFAULT_HOMEPAGE_COUNTDOWN_ISO);
}

function parseTermineJson(value: HomepageCountdown["termine"]): HomepageCountdownTermin[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is HomepageCountdownTermin => !!item && typeof item === "object") as HomepageCountdownTermin[];
}


function buildFourTermine(value: HomepageCountdown["termine"], countdownTarget: Date | null): HomepageCountdownTermin[] {
  const parsed = parseTermineJson(value);
  const base = Array.from({ length: 4 }).map((_, index) => ({ datum: "", uhrzeit: "", label: `Vorstellung ${index + 1}` }));
  parsed.slice(0,4).forEach((item, index) => { base[index] = { datum: item.datum ?? "", uhrzeit: item.uhrzeit ?? "", label: item.label ?? `Vorstellung ${index + 1}` }; });
  if ((!base[0].datum || !base[0].uhrzeit) && countdownTarget) {
    const iso = countdownTarget.toISOString();
    base[0] = { datum: iso.slice(0,10), uhrzeit: iso.slice(11,16), label: "Vorstellung 1" };
  }
  return base;
}

export function resolveHomepageCountdown(record: HomepageCountdownRecord) {
  const defaultCountdown = getDefaultCountdownDate();
  const storedCountdown = record?.countdownTarget ?? null;
  const effectiveCountdownTarget = storedCountdown ?? defaultCountdown;
  const disabled = record?.disabled ?? false;

  return {
    countdownTarget: storedCountdown,
    effectiveCountdownTarget,
    updatedAt: record?.updatedAt ?? null,
    hasCustomCountdown: storedCountdown !== null,
    disabled,
    termine: buildFourTermine(record?.termine, storedCountdown),
    nachSommerText: record?.nachSommerText ?? "Bis zum nächsten Sommer!",
  } as const;
}

export async function readHomepageCountdown() {
  return prisma.homepageCountdown.findUnique({ where: { id: HOMEPAGE_COUNTDOWN_ID } });
}

export async function saveHomepageCountdown(data: {
  countdownTarget: Date | null;
  disabled: boolean;
  termine: HomepageCountdownTermin[];
  nachSommerText: string;
}) {
  return prisma.homepageCountdown.upsert({
    where: { id: HOMEPAGE_COUNTDOWN_ID },
    update: data,
    create: {
      id: HOMEPAGE_COUNTDOWN_ID,
      ...data,
    },
  });
}
