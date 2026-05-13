import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const PREMIERE_COUNTDOWN_SETTINGS_ID = "public";
export const DEFAULT_PREMIERE_COUNTDOWN_ISO = "2026-06-18T17:00:00.000Z";

export type PremiereCountdownSettingsRecord = Awaited<ReturnType<typeof readPremiereCountdownSettings>>;

export type PremiereCountdownSettingsTermin = { datum: string; uhrzeit: string; label?: string };

function getDefaultCountdownDate() {
  return new Date(DEFAULT_PREMIERE_COUNTDOWN_ISO);
}

function parseTermineJson(value: Prisma.JsonValue): PremiereCountdownSettingsTermin[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PremiereCountdownSettingsTermin => !!item && typeof item === "object") as PremiereCountdownSettingsTermin[];
}


function buildFourTermine(value: Prisma.JsonValue, countdownTarget: Date | null): PremiereCountdownSettingsTermin[] {
  const parsed = parseTermineJson(value);
  const base = Array.from({ length: 4 }).map((_, index) => ({ datum: "", uhrzeit: "", label: `Vorstellung ${index + 1}` }));
  parsed.slice(0,4).forEach((item, index) => { base[index] = { datum: item.datum ?? "", uhrzeit: item.uhrzeit ?? "", label: item.label ?? `Vorstellung ${index + 1}` }; });
  if ((!base[0].datum || !base[0].uhrzeit) && countdownTarget) {
    const iso = countdownTarget.toISOString();
    base[0] = { datum: iso.slice(0,10), uhrzeit: iso.slice(11,16), label: "Vorstellung 1" };
  }
  return base;
}

export function resolvePremiereCountdownSettings(record: PremiereCountdownSettingsRecord) {
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
    termine: buildFourTermine(record?.termine ?? [], storedCountdown),
    nachSommerText: record?.nachSommerText ?? "Bis zum nächsten Sommer!",
  } as const;
}

export async function readPremiereCountdownSettings() {
  return prisma.homepageCountdown.findUnique({ where: { id: PREMIERE_COUNTDOWN_SETTINGS_ID } });
}

export async function savePremiereCountdownSettings(data: {
  countdownTarget: Date | null;
  disabled: boolean;
  termine: PremiereCountdownSettingsTermin[];
  nachSommerText: string;
}) {
  return prisma.homepageCountdown.upsert({
    where: { id: PREMIERE_COUNTDOWN_SETTINGS_ID },
    update: data,
    create: {
      id: PREMIERE_COUNTDOWN_SETTINGS_ID,
      ...data,
    },
  });
}
