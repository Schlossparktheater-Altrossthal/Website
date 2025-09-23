import { prisma } from "@/lib/prisma";
import type { HomepageCountdown } from "@prisma/client";

export const HOMEPAGE_COUNTDOWN_ID = "public";
export const DEFAULT_HOMEPAGE_COUNTDOWN_ISO = "2026-06-18T17:00:00.000Z";

export type HomepageCountdownRecord = HomepageCountdown | null;

function getDefaultCountdownDate() {
  return new Date(DEFAULT_HOMEPAGE_COUNTDOWN_ISO);
}

export function resolveHomepageCountdown(record: HomepageCountdownRecord) {
  const defaultCountdown = getDefaultCountdownDate();
  const storedCountdown = record?.countdownTarget ?? null;
  const effectiveCountdownTarget = storedCountdown ?? defaultCountdown;

  return {
    countdownTarget: storedCountdown,
    effectiveCountdownTarget,
    updatedAt: record?.updatedAt ?? null,
    hasCustomCountdown: storedCountdown !== null,
  } as const;
}

export async function readHomepageCountdown() {
  return prisma.homepageCountdown.findUnique({ where: { id: HOMEPAGE_COUNTDOWN_ID } });
}

export async function saveHomepageCountdown(data: { countdownTarget: Date | null }) {
  return prisma.homepageCountdown.upsert({
    where: { id: HOMEPAGE_COUNTDOWN_ID },
    update: {
      countdownTarget: data.countdownTarget,
    },
    create: {
      id: HOMEPAGE_COUNTDOWN_ID,
      countdownTarget: data.countdownTarget,
    },
  });
}
