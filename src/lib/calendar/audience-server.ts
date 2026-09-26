import type { Prisma } from "@prisma/client";
import { z } from "zod";

import {
  AUDIENCE_RULE_TYPES,
  PARTICIPATION_LEVELS,
  resolveAudience,
  TARGETED_RULE_TYPES,
  type AudienceContext,
  type AudienceOverride,
  type AudienceRule,
} from "@/lib/calendar/audience";
import { compareMembersByLastName, getUserDisplayName } from "@/lib/names";
import { prisma } from "@/lib/prisma";
import { currentMembershipWhere } from "@/lib/produktionen/status";

export const audienceInputSchema = z.object({
  rules: z
    .array(
      z
        .object({
          type: z.enum(AUDIENCE_RULE_TYPES),
          targetId: z.string().min(1).nullable(),
          level: z.enum(PARTICIPATION_LEVELS),
        })
        .refine((rule) => !TARGETED_RULE_TYPES.has(rule.type) || rule.targetId, {
          message: "Regel ohne Ziel",
        }),
    )
    .max(100),
  overrides: z
    .array(
      z.object({
        userId: z.string().min(1),
        override: z.enum(["INCLUDED", "EXCLUDED"]).nullable(),
        level: z.enum(PARTICIPATION_LEVELS).nullable(),
      }),
    )
    .max(1000),
});

export type AudienceInput = z.infer<typeof audienceInputSchema>;

const userSelect = { id: true, firstName: true, lastName: true, name: true, email: true } as const;

/** Alles, was die Regeln einer Produktion auflösen (ohne Produktion: alle aktiven Mitglieder). */
export async function loadAudienceContext(showId: string | null): Promise<AudienceContext> {
  const activeUser = { deactivatedAt: null };
  const [users, characters, scenes, departments] = await Promise.all([
    prisma.user.findMany({
      where: showId
        ? {
            ...activeUser,
            OR: [
              { productionMemberships: { some: { showId, ...currentMembershipWhere() } } },
              { characterCastings: { some: { character: { showId } } } },
              {
                departmentMemberships: {
                  some: { status: "active", department: { showId, archivedAt: null } },
                },
              },
            ],
          }
        : activeUser,
      select: userSelect,
    }),
    showId
      ? prisma.character.findMany({
          where: { showId },
          orderBy: { order: "asc" },
          select: {
            id: true,
            name: true,
            castings: { where: { user: activeUser }, select: { userId: true, type: true } },
          },
        })
      : [],
    showId
      ? prisma.scene.findMany({
          where: { showId },
          orderBy: [{ act: "asc" }, { sequence: "asc" }],
          select: {
            id: true,
            identifier: true,
            sequence: true,
            title: true,
            characters: { select: { characterId: true } },
          },
        })
      : [],
    showId
      ? prisma.department.findMany({
          where: { showId, archivedAt: null },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            memberships: {
              where: { status: "active", user: activeUser },
              select: { userId: true },
            },
          },
        })
      : [],
  ]);

  return {
    hasProduction: Boolean(showId),
    members: [...users]
      .sort(compareMembersByLastName)
      .map((user) => ({ id: user.id, name: getUserDisplayName(user) })),
    characters: characters.map(({ id, name }) => ({ id, name })),
    castings: characters.flatMap((character) =>
      character.castings.map((casting) => ({ characterId: character.id, ...casting })),
    ),
    scenes: scenes.map((scene) => ({
      id: scene.id,
      label: `Sz. ${scene.identifier || scene.sequence}${scene.title ? ` ${scene.title}` : ""}`,
      characterIds: scene.characters.map((entry) => entry.characterId),
    })),
    departments: departments.map((department) => ({
      id: department.id,
      name: department.name,
      memberIds: department.memberships.map((entry) => entry.userId),
    })),
  };
}

/** Gespeicherte Regeln und Handänderungen eines Termins. */
export async function readEventAudience(eventId: string) {
  const [rules, participants] = await Promise.all([
    prisma.eventAudienceRule.findMany({
      where: { eventId },
      orderBy: { sortOrder: "asc" },
      select: { type: true, targetId: true, level: true },
    }),
    prisma.eventParticipant.findMany({
      where: { eventId },
      select: {
        userId: true,
        invited: true,
        level: true,
        override: true,
        levelOverride: true,
        response: true,
        responseNote: true,
        user: { select: userSelect },
      },
    }),
  ]);
  const overrides: AudienceOverride[] = participants
    .filter((entry) => entry.override || entry.levelOverride)
    .map((entry) => ({
      userId: entry.userId,
      override: entry.override,
      level: entry.levelOverride,
    }));
  const invited = participants
    .filter((entry) => entry.invited)
    .map((entry) => ({
      userId: entry.userId,
      name: getUserDisplayName(entry.user),
      level: entry.level,
    }));
  /** Absagen (Person → Begründung) für die Anzeige in der Planung. */
  const declined: Record<string, string | null> = Object.fromEntries(
    participants
      .filter((entry) => entry.response === "no" || entry.response === "emergency")
      .map((entry) => [entry.userId, entry.responseNote]),
  );
  return { rules: rules satisfies AudienceRule[], overrides, invited, declined };
}

/**
 * Speichert Regeln und Handänderungen und berechnet die Eingeladenen neu. Personen mit
 * Rückmeldung bleiben als Rückmeldung erhalten, auch wenn sie nicht mehr eingeladen sind.
 */
export async function saveEventAudience(
  tx: Prisma.TransactionClient,
  eventId: string,
  audience: AudienceInput,
  context: AudienceContext,
) {
  const resolved = resolveAudience(audience.rules, audience.overrides, context);
  const invited = resolved.filter((entry) => !entry.excluded);
  const invitedIds = invited.map((entry) => entry.userId);

  const before = await tx.eventParticipant.findMany({
    where: { eventId, invited: true },
    select: { userId: true },
  });
  const beforeIds = new Set(before.map((entry) => entry.userId));

  await tx.eventAudienceRule.deleteMany({ where: { eventId } });
  if (audience.rules.length) {
    await tx.eventAudienceRule.createMany({
      data: audience.rules.map((rule, index) => ({ eventId, ...rule, sortOrder: index })),
    });
  }

  const keep = resolved.map((entry) => entry.userId);
  const stale = { eventId, userId: { notIn: keep } };
  await tx.eventParticipant.deleteMany({ where: { ...stale, response: null } });
  await tx.eventParticipant.updateMany({
    where: stale,
    data: { invited: false, override: null, levelOverride: null, reasons: [] },
  });

  for (const entry of resolved) {
    const data = {
      invited: !entry.excluded,
      level: entry.level,
      reasons: entry.reasons,
      override: entry.override,
      levelOverride: entry.levelOverride,
    };
    await tx.eventParticipant.upsert({
      where: { eventId_userId: { eventId, userId: entry.userId } },
      update: data,
      create: { eventId, userId: entry.userId, ...data },
    });
  }

  return {
    invitedIds,
    addedIds: invitedIds.filter((id) => !beforeIds.has(id)),
    removedIds: [...beforeIds].filter((id) => !invitedIds.includes(id)),
  };
}
