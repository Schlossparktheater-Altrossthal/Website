import { prisma } from "@/lib/prisma";
import type { MysterySettings } from "@prisma/client";

export const MYSTERY_SETTINGS_IDS = {
  public: "default",
  members: "members",
} as const;
export const DEFAULT_MYSTERY_COUNTDOWN_ISO = "2025-10-15T10:00:00.000Z";
export const DEFAULT_MYSTERY_EXPIRATION_MESSAGE = "Das erste Rätsel ist jetzt verfügbar!";

export type MysterySettingsRecord = MysterySettings | null;

export type MysterySettingsScope = keyof typeof MYSTERY_SETTINGS_IDS;

function resolveScopeId(scope: MysterySettingsScope) {
  return MYSTERY_SETTINGS_IDS[scope];
}

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

export async function readMysterySettings(scope: MysterySettingsScope = "public") {
  return prisma.mysterySettings.findUnique({ where: { id: resolveScopeId(scope) } });
}

export async function saveMysterySettings(
  scope: MysterySettingsScope = "public",
  data: { countdownTarget: Date | null; expirationMessage: string | null },
) {
  const id = resolveScopeId(scope);
  return prisma.mysterySettings.upsert({
    where: { id },
    update: {
      countdownTarget: data.countdownTarget,
      expirationMessage: data.expirationMessage,
    },
    create: {
      id,
      countdownTarget: data.countdownTarget,
      expirationMessage: data.expirationMessage,
    },
  });
}
