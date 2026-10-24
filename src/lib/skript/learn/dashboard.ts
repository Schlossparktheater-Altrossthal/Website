import { prisma } from "@/lib/prisma";

import { loadScriptReader } from "../reader";
import { tokenizeBlock } from "./chunks";
import { itemKey, sceneProgress, summarize, type LearnItem, type StoredCard } from "./plan";
import { latestReleasedVersion } from "./service";
import { learnRoleIds } from "../role-links";
import { isSpoken } from "../types";

/** Skript-Karte auf dem Dashboard: aktuelle Fassung und – mit Rolle – der eigene Lernstand. */

export type DashboardScript = {
  showId: string;
  versionId: string;
  label: string;
  versionDate: string | null;
  roleNames: string[];
  /** Nur mit eigener Rolle. */
  learn: {
    total: number;
    solid: number;
    learning: number;
    fresh: number;
    /** Heute fällige Stellen (geändert oder Wiederholung, ohne neue). */
    due: number;
    changed: number;
  } | null;
};

export async function loadDashboardScript(
  showId: string,
  userId: string,
  now = new Date(),
): Promise<DashboardScript | null> {
  const version = await latestReleasedVersion(showId);
  if (!version) return null;
  const reader = await loadScriptReader(version.id, userId);
  if (!reader) return null;

  const base = {
    showId,
    versionId: reader.version.id,
    label: reader.version.label,
    versionDate: reader.version.versionDate,
    roleNames: reader.roles
      .filter((role) => reader.ownRoleIds.includes(role.id))
      .map((role) => role.name),
  };
  if (!reader.ownRoleIds.length) return { ...base, learn: null };

  // Gleiche Abschnitte wie im Lernmodus (buildUnits), nur die eigenen Rollen.
  const own = new Set(reader.ownRoleIds);
  const groupIds = new Set(reader.roles.filter((r) => r.kind === "group").map((r) => r.id));
  const items: LearnItem[] = [];
  reader.blocks.forEach((block, blockIndex) => {
    const roles = learnRoleIds(block, own, true, groupIds);
    if (!isSpoken(block.kind) || !roles.length) return;
    for (const chunk of tokenizeBlock(block.parts).chunks) {
      for (const roleId of roles) {
        items.push({
          key: itemKey(roleId, block.lineageId, chunk.index),
          roleId,
          blockId: block.id,
          lineageId: block.lineageId,
          sceneId: block.sceneId,
          chunk: chunk.index,
          hash: chunk.hash,
          words: chunk.words.length,
          order: blockIndex * 1000 + chunk.index,
        });
      }
    }
  });

  const rows = await prisma.scriptLearnCard.findMany({ where: { userId, showId } });
  const cards = new Map<string, StoredCard>(
    rows.map((card) => [
      itemKey(card.roleId, card.lineageId, card.chunk),
      {
        textHash: card.textHash,
        text: card.text,
        createdAt: card.createdAt.toISOString(),
        state: card.state,
        due: card.due.toISOString(),
        stability: card.stability,
        difficulty: card.difficulty,
        scheduledDays: card.scheduledDays,
        learningSteps: card.learningSteps,
        reps: card.reps,
        lapses: card.lapses,
        lastReview: card.lastReview?.toISOString() ?? null,
      },
    ]),
  );
  const input = { items, cards, rehearsals: new Map<string, string>(), now };
  const scenes = sceneProgress(input);
  const sum = (key: "total" | "solid" | "learning" | "new" | "changed") =>
    scenes.reduce((total, scene) => total + scene[key], 0);
  const { due, changed } = summarize(input);
  return {
    ...base,
    learn: {
      total: sum("total"),
      solid: sum("solid"),
      learning: sum("learning"),
      fresh: sum("new"),
      due: new Set([...due, ...changed].map((item) => `${item.lineageId}|${item.chunk}`)).size,
      changed: sum("changed"),
    },
  };
}
