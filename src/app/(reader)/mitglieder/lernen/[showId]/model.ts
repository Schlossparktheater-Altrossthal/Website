"use client";

import * as React from "react";

import type { ReaderBlock, ScriptReaderData } from "@/lib/skript/reader";
import { tokenizeBlock, type TokenizedBlock } from "@/lib/skript/learn/chunks";
import type { HistoryEntry } from "@/lib/skript/learn/insights";
import { itemKey, type LearnItem, type StoredCard } from "@/lib/skript/learn/plan";
import { applyReview, type LearnRating, type Stage } from "@/lib/skript/learn/schedule";
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
  stage?: Exclude<Stage, "full">;
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
        text: chunk.words.join(" "),
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
const SNAPSHOT_KEY = (showId: string) => `lernen-stand:${showId}`;

type Snapshot = { cards: Record<string, StoredCard>; history: HistoryEntry[] };

/**
 * Offline: der Lernstand liegt zusätzlich im Gerät. Beim Laden (auch aus dem Cache ohne Netz)
 * zählen lokale Stände nur, wenn sie nach dem Erzeugen der Seite entstanden sind – so kommen
 * offline Gelerntes zurück, ein Zurücksetzen auf einem anderen Gerät aber nicht.
 */
export function mergeSnapshot(
  cards: ReadonlyMap<string, StoredCard>,
  history: readonly HistoryEntry[],
  snapshot: Partial<Snapshot> | null,
  generatedAt: string,
) {
  const mergedCards = new Map(cards);
  for (const [key, local] of Object.entries(snapshot?.cards ?? {})) {
    if (!local?.lastReview || local.lastReview <= generatedAt) continue;
    const server = cards.get(key);
    if (!server?.lastReview || local.lastReview > server.lastReview) mergedCards.set(key, local);
  }
  const seen = new Set(history.map((entry) => `${entry.key}|${entry.at}`));
  const extra = (snapshot?.history ?? []).filter(
    (entry) => entry.at > generatedAt && !seen.has(`${entry.key}|${entry.at}`),
  );
  return { cards: mergedCards, history: extra.length ? [...history, ...extra] : [...history] };
}

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
  const cardsRef = React.useRef(cards);
  cardsRef.current = cards;
  const [reviewTimes, setReviewTimes] = React.useState<string[]>(data.recentReviews);
  const [history, setHistory] = React.useState<HistoryEntry[]>(() => {
    const keys = new Map(
      data.cards.map((card) => [card.id, itemKey(card.roleId, card.lineageId, card.chunk)]),
    );
    return data.history.flatMap((entry) => {
      const key = keys.get(entry.cardId);
      return key ? [{ key, at: entry.at, rating: entry.rating, mode: entry.mode }] : [];
    });
  });
  const historyRef = React.useRef(history);
  historyRef.current = history;
  const [pending, setPending] = React.useState(0);
  const [offline, setOffline] = React.useState(false);
  const sending = React.useRef(false);

  // Lokalen Stand nach dem Laden einmischen und danach bei jeder Änderung sichern.
  const restored = React.useRef(false);
  React.useEffect(() => {
    const merged = mergeSnapshot(
      cardsRef.current,
      historyRef.current,
      readStored<Snapshot>(SNAPSHOT_KEY(showId)),
      data.generatedAt,
    );
    const extra = merged.history.slice(historyRef.current.length);
    setCards(merged.cards);
    setHistory(merged.history);
    if (extra.length) setReviewTimes((times) => [...times, ...extra.map((entry) => entry.at)]);
    restored.current = true;
  }, [showId, data.generatedAt]);
  React.useEffect(() => {
    if (!restored.current) return;
    writeStored(SNAPSHOT_KEY(showId), {
      cards: Object.fromEntries(cards),
      history: history.filter((entry) => entry.at > data.generatedAt),
    });
  }, [cards, history, showId, data.generatedAt]);

  const flush = React.useCallback(async () => {
    if (sending.current) return;
    const read = () =>
      (readStored<{ entries: ReviewEntry[] }>(OUTBOX_KEY(showId))?.entries ?? []) as ReviewEntry[];
    sending.current = true;
    try {
      // Während des Sendens neu dazugekommene Bewertungen gleich hinterherschicken.
      for (let queue = read(); queue.length; queue = read()) {
        setPending(queue.length);
        const result = await submitReviewsAction(showId, queue);
        // Abgelehnte Einträge (z. B. Rolle gestrichen) nicht endlos wiederholen.
        if (!result.ok) console.warn("[lernen] Speichern abgelehnt", result.error);
        writeStored(OUTBOX_KEY(showId), { entries: read().slice(queue.length) });
        setOffline(false);
      }
      setPending(0);
    } catch (error) {
      console.warn("[lernen] Keine Verbindung, später erneut", error);
      setOffline(true);
      setPending(read().length);
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
    (unit: Unit, rating: LearnRating, meta: ReviewMeta) => {
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
            ...applyReview(previous, rating, at, {
              changed: !!previous && previous.textHash !== item.hash,
              stage: meta.stage,
              premiere: data.premiereAt,
            }),
            textHash: item.hash,
            text: item.text ?? previous?.text ?? null,
            createdAt: previous?.createdAt ?? at.toISOString(),
          });
        }
        return next;
      });
      setReviewTimes((times) => [...times, at.toISOString()]);
      setHistory((current) => [
        ...current,
        ...unit.items.map((item) => ({
          key: item.key,
          at: at.toISOString(),
          rating,
          mode: meta.mode,
        })),
      ]);
      const stored = (readStored<{ entries: ReviewEntry[] }>(OUTBOX_KEY(showId))?.entries ??
        []) as ReviewEntry[];
      writeStored(OUTBOX_KEY(showId), { entries: [...stored, ...entries] });
      setPending(stored.length + entries.length);
      void flush();
    },
    [flush, showId, data.premiereAt],
  );

  const resetRoleLocal = React.useCallback((roleId: string) => {
    setCards((current) => {
      const next = new Map(current);
      for (const key of current.keys()) if (key.startsWith(`${roleId}|`)) next.delete(key);
      return next;
    });
    setHistory((current) => current.filter((entry) => !entry.key.startsWith(`${roleId}|`)));
  }, []);

  return { cards, reviewTimes, history, pending, offline, review, resetRoleLocal };
}

export type ReviewMeta = {
  auto: boolean;
  revealed: number;
  mode: "flow" | "drill";
  stage: Exclude<Stage, "full">;
};

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
