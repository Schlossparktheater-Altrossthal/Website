"use client";

import * as React from "react";

import type { ReaderBlock, ScriptReaderData } from "@/lib/skript/reader";
import { tokenizeBlock, type TokenizedBlock } from "@/lib/skript/learn/chunks";
import { itemKey, type LearnItem, type StoredCard } from "@/lib/skript/learn/plan";
import { applyRating, type LearnRating, type Stage } from "@/lib/skript/learn/schedule";
import type { LearnPageData } from "@/lib/skript/learn/service";

import { readStored, writeStored } from "../../skript/shared";
import { submitReviewsAction } from "./actions";

/** Zustand des Lernmodus im Browser (docs/Plan/lernmodus-plan.md). */

export type LearnSettings = {
  roleIds: string[];
  stage: "auto" | Stage;
  speak: boolean;
  typing: boolean;
  fontSize: number;
};

/**
 * Eine Lerneinheit = ein Abschnitt einer Replik; bei gemeinsamen Repliken (L2) gehören mehrere
 * Rollen-Karten dazu, die zusammen bewertet werden.
 */
export type Unit = {
  id: string;
  block: ReaderBlock;
  blockIndex: number;
  chunk: number;
  items: LearnItem[];
};

export type ReviewEntry = {
  roleId: string;
  lineageId: string;
  chunk: number;
  rating: LearnRating;
  auto: boolean;
  revealed: number;
  mode: "flow" | "drill";
  at: string;
};

export function unitId(lineageId: string, chunk: number) {
  return `${lineageId}|${chunk}`;
}

export function useLearnSettings(showId: string, ownRoleIds: string[]) {
  const key = `lernen:${showId}`;
  const [settings, setSettings] = React.useState<LearnSettings>({
    roleIds: ownRoleIds,
    stage: "auto",
    speak: false,
    typing: false,
    fontSize: 1,
  });
  const loaded = React.useRef(false);
  React.useEffect(() => {
    const stored = readStored<LearnSettings>(key);
    const finePointer = window.matchMedia?.("(pointer: fine)").matches ?? false;
    setSettings((current) => ({ ...current, typing: finePointer, ...stored }));
    loaded.current = true;
  }, [key]);
  const update = React.useCallback(
    (patch: Partial<LearnSettings>) =>
      setSettings((current) => {
        const next = { ...current, ...patch };
        if (loaded.current) writeStored(key, next);
        return next;
      }),
    [key],
  );
  return [settings, update] as const;
}

/** Wörter und Abschnitte je Replik, einmal je Fassung berechnet. */
export function useTokenized(reader: ScriptReaderData) {
  return React.useMemo(() => {
    const map = new Map<string, TokenizedBlock>();
    for (const block of reader.blocks) {
      if (block.kind === "speech") map.set(block.id, tokenizeBlock(block.parts));
    }
    return map;
  }, [reader.blocks]);
}

export function buildUnits(
  reader: ScriptReaderData,
  tokenized: ReadonlyMap<string, TokenizedBlock>,
  roleIds: readonly string[],
) {
  const selected = new Set(roleIds);
  const items: LearnItem[] = [];
  const units: Unit[] = [];
  reader.blocks.forEach((block, blockIndex) => {
    const roles = block.roleIds.filter((id) => selected.has(id));
    if (block.kind !== "speech" || !roles.length) return;
    const tokens = tokenized.get(block.id);
    for (const chunk of tokens?.chunks ?? []) {
      const unitItems = roles.map((roleId) => ({
        key: itemKey(roleId, block.lineageId, chunk.index),
        roleId,
        blockId: block.id,
        lineageId: block.lineageId,
        sceneId: block.sceneId,
        chunk: chunk.index,
        hash: chunk.hash,
        words: chunk.words.length,
        order: blockIndex * 1000 + chunk.index,
      }));
      items.push(...unitItems);
      units.push({
        id: unitId(block.lineageId, chunk.index),
        block,
        blockIndex,
        chunk: chunk.index,
        items: unitItems,
      });
    }
  });
  return { items, units, byId: new Map(units.map((unit) => [unit.id, unit])) };
}

/** Einheiten in Reihenfolge der Karten, ohne doppelte gemeinsame Repliken. */
export function itemsToUnits(items: readonly LearnItem[], byId: ReadonlyMap<string, Unit>) {
  const seen = new Set<string>();
  const result: Unit[] = [];
  for (const item of items) {
    const id = unitId(item.lineageId, item.chunk);
    const unit = byId.get(id);
    if (!unit || seen.has(id)) continue;
    seen.add(id);
    result.push(unit);
  }
  return result;
}

/** Schwächster Zustand einer Einheit (für Stufe und Anzeige). */
export function unitCard(unit: Unit, cards: ReadonlyMap<string, StoredCard>) {
  let weakest: StoredCard | null = null;
  let changed = false;
  for (const item of unit.items) {
    const card = cards.get(item.key);
    if (!card) return { card: null, changed: false };
    if (card.textHash !== item.hash) changed = true;
    if (!weakest || card.stability < weakest.stability) weakest = card;
  }
  return { card: weakest, changed };
}

const OUTBOX_KEY = (showId: string) => `lernen-outbox:${showId}`;

/**
 * Lernstand mit sofortiger Berechnung im Browser und Warteschlange zum Server – funktioniert
 * auch ohne Netz; beim nächsten Kontakt wird nachgereicht.
 */
export function useLearnStore(data: LearnPageData) {
  const showId = data.reader.version.showId;
  const [cards, setCards] = React.useState(() => {
    const map = new Map<string, StoredCard>();
    for (const card of data.cards) {
      map.set(itemKey(card.roleId, card.lineageId, card.chunk), card);
    }
    return map;
  });
  const [reviewTimes, setReviewTimes] = React.useState<string[]>(data.recentReviews);
  const [pending, setPending] = React.useState(0);
  const [offline, setOffline] = React.useState(false);
  const sending = React.useRef(false);

  const flush = React.useCallback(async () => {
    if (sending.current) return;
    const queue = (readStored<{ entries: ReviewEntry[] }>(OUTBOX_KEY(showId))?.entries ??
      []) as ReviewEntry[];
    setPending(queue.length);
    if (!queue.length) return;
    sending.current = true;
    try {
      const result = await submitReviewsAction(showId, queue);
      if (result.ok) {
        const rest = (
          (readStored<{ entries: ReviewEntry[] }>(OUTBOX_KEY(showId))?.entries ??
            []) as ReviewEntry[]
        ).slice(queue.length);
        writeStored(OUTBOX_KEY(showId), { entries: rest });
        setPending(rest.length);
        setOffline(false);
      } else {
        console.warn("[lernen] Speichern abgelehnt", result.error);
        // Ungültige Einträge (z. B. Rolle gestrichen) nicht endlos wiederholen.
        writeStored(OUTBOX_KEY(showId), { entries: [] });
        setPending(0);
      }
    } catch (error) {
      console.warn("[lernen] Keine Verbindung, später erneut", error);
      setOffline(true);
    } finally {
      sending.current = false;
    }
  }, [showId]);

  React.useEffect(() => {
    void flush();
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    const timer = window.setInterval(() => void flush(), 30_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(timer);
    };
  }, [flush]);

  const review = React.useCallback(
    (
      unit: Unit,
      rating: LearnRating,
      meta: { auto: boolean; revealed: number; mode: "flow" | "drill" },
    ) => {
      const at = new Date();
      const entries: ReviewEntry[] = unit.items.map((item) => ({
        roleId: item.roleId,
        lineageId: item.lineageId,
        chunk: item.chunk,
        rating,
        at: at.toISOString(),
        ...meta,
      }));
      setCards((current) => {
        const next = new Map(current);
        for (const item of unit.items) {
          const previous = current.get(item.key) ?? null;
          next.set(item.key, {
            ...applyRating(previous, rating, at),
            textHash: item.hash,
            createdAt: previous?.createdAt ?? at.toISOString(),
          });
        }
        return next;
      });
      setReviewTimes((times) => [...times, at.toISOString()]);
      const stored = (readStored<{ entries: ReviewEntry[] }>(OUTBOX_KEY(showId))?.entries ??
        []) as ReviewEntry[];
      writeStored(OUTBOX_KEY(showId), { entries: [...stored, ...entries] });
      setPending(stored.length + entries.length);
      void flush();
    },
    [flush, showId],
  );

  const resetRoleLocal = React.useCallback((roleId: string) => {
    setCards((current) => {
      const next = new Map(current);
      for (const key of current.keys()) if (key.startsWith(`${roleId}|`)) next.delete(key);
      return next;
    });
  }, []);

  return { cards, reviewTimes, pending, offline, review, resetRoleLocal };
}

export type ReviewMeta = { auto: boolean; revealed: number; mode: "flow" | "drill" };

/** So lange lässt sich die vorgeschlagene Bewertung noch ändern. */
export const CORRECTION_MS = 4000;

/**
 * Hält die letzte Bewertung kurz zurück, damit sie korrigiert werden kann (L6), und speichert sie
 * danach – spätestens bei der nächsten Bewertung oder beim Verlassen.
 */
export function useDeferredReview(
  commit: (unit: Unit, rating: LearnRating, meta: ReviewMeta) => void,
) {
  const [last, setLast] = React.useState<{
    unit: Unit;
    rating: LearnRating;
    meta: ReviewMeta;
  } | null>(null);
  const lastRef = React.useRef(last);
  lastRef.current = last;
  const commitRef = React.useRef(commit);
  commitRef.current = commit;

  const settle = React.useCallback(() => {
    const entry = lastRef.current;
    if (!entry) return;
    lastRef.current = null;
    setLast(null);
    commitRef.current(entry.unit, entry.rating, entry.meta);
  }, []);

  React.useEffect(() => {
    if (!last) return;
    const timer = window.setTimeout(settle, CORRECTION_MS);
    return () => window.clearTimeout(timer);
  }, [last, settle]);
  React.useEffect(() => {
    window.addEventListener("pagehide", settle);
    return () => {
      window.removeEventListener("pagehide", settle);
      settle();
    };
  }, [settle]);

  const propose = React.useCallback(
    (unit: Unit, rating: LearnRating, meta: ReviewMeta) => {
      settle();
      const entry = { unit, rating, meta };
      lastRef.current = entry;
      setLast(entry);
    },
    [settle],
  );
  const change = React.useCallback((rating: LearnRating) => {
    const entry = lastRef.current;
    if (!entry) return;
    const next = { ...entry, rating, meta: { ...entry.meta, auto: false } };
    lastRef.current = next;
    setLast(next);
  }, []);

  return { last, propose, change, settle };
}
