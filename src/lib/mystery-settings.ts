import { prisma } from "@/lib/prisma";
import type { MysterySettings } from "@prisma/client";

export const MYSTERY_SETTINGS_ID = "default" as const;
export const DEFAULT_MYSTERY_COUNTDOWN_ISO = "2025-10-15T10:00:00.000Z";
export const DEFAULT_MYSTERY_EXPIRATION_MESSAGE = "Das erste Rätsel ist jetzt verfügbar!";

export type MysterySettingsRecord = MysterySettings | null;

function getDefaultCountdownDate() {
  return new Date(DEFAULT_MYSTERY_COUNTDOWN_ISO);
}

export function resolveMysterySettings(record: MysterySettingsRecord) {
  const defaultCountdown = getDefaultCountdownDate();
  const storedCountdown = record?.countdownTarget ?? null;
  const storedMessageRaw = record?.expirationMessage ?? null;
  const trimmedMessage = typeof storedMessageRaw === "string" ? storedMessageRaw.trim() : null;
  const hasMessage = Boolean(trimmedMessage);
  const effectiveCountdownTarget = storedCountdown ?? defaultCountdown;
  const effectiveExpirationMessage = hasMessage ? (trimmedMessage as string) : DEFAULT_MYSTERY_EXPIRATION_MESSAGE;

  return {
    countdownTarget: storedCountdown,
    expirationMessage: hasMessage ? (trimmedMessage as string) : null,
    effectiveCountdownTarget,
    effectiveExpirationMessage,
    updatedAt: record?.updatedAt ?? null,
    hasCustomCountdown: storedCountdown !== null,
    hasCustomMessage: hasMessage,
  } as const;
}

export async function readMysterySettings() {
  return prisma.mysterySettings.findUnique({ where: { id: MYSTERY_SETTINGS_ID } });
}

export async function saveMysterySettings(data: { countdownTarget: Date | null; expirationMessage: string | null }) {
  return prisma.mysterySettings.upsert({
    where: { id: MYSTERY_SETTINGS_ID },
    update: {
      countdownTarget: data.countdownTarget,
      expirationMessage: data.expirationMessage,
    },
    create: {
      id: MYSTERY_SETTINGS_ID,
      countdownTarget: data.countdownTarget,
      expirationMessage: data.expirationMessage,
    },
  });
}
