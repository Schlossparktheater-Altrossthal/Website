import { Prisma } from "@prisma/client";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    return {};
  }
  return { ...value };
}

export function getOnboardingWhatsAppLink(
  meta: Prisma.JsonValue | null | undefined,
): string | null {
  if (!isRecord(meta)) {
    return null;
  }
  const onboarding = (meta as Record<string, unknown>).onboarding;
  if (!isRecord(onboarding)) {
    return null;
  }
  const rawLink = onboarding.whatsappLink;
  if (typeof rawLink !== "string") {
    return null;
  }
  const trimmed = rawLink.trim();
  return trimmed ? trimmed : null;
}

export function setOnboardingWhatsAppLink(
  meta: Prisma.JsonValue | null | undefined,
  link: string | null,
): Prisma.JsonObject | Prisma.JsonNullValueInput {
  const base = cloneRecord(meta);
  const onboarding = cloneRecord(base.onboarding);

  if (link) {
    onboarding.whatsappLink = link;
    base.onboarding = onboarding;
  } else {
    delete onboarding.whatsappLink;
    if (Object.keys(onboarding).length > 0) {
      base.onboarding = onboarding;
    } else {
      delete base.onboarding;
    }
  }

  if (Object.keys(base).length === 0) {
    return Prisma.JsonNull;
  }

  return base as Prisma.JsonObject;
}
