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
    termine: record ? parseTermineJson(record.termine) : [],
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
