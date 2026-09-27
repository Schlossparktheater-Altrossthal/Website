"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useNotificationRealtime } from "@/hooks/useRealtime";
import {
  countInbox,
  groupInboxItems,
  type InboxCounts,
  type InboxItem,
  type InboxSection,
  type InboxStateAction,
} from "@/lib/notifications/inbox-shared";
import type { NotificationCategory } from "@/lib/notifications/types";

export type InboxFilter = {
  section?: InboxSection;
  category?: NotificationCategory;
  archived?: boolean;
  q?: string;
  limit?: number;
};

export type InboxTarget = { ids?: string[]; groupKeys?: string[]; all?: boolean };

type InboxResponse = {
  items: InboxItem[];
  counts: InboxCounts;
  nextCursor: string | null;
  hints?: { deviceNotificationsDismissed?: boolean };
};

const EMPTY_COUNTS: InboxCounts = countInbox([]);

function buildQuery(filter: InboxFilter, cursor?: string | null) {
  const params = new URLSearchParams();
  if (filter.section) params.set("section", filter.section);
  if (filter.category) params.set("category", filter.category);
  if (filter.archived) params.set("archived", "1");
  if (filter.q?.trim()) params.set("q", filter.q.trim());
  if (filter.limit) params.set("limit", String(filter.limit));
  if (cursor) params.set("cursor", cursor);
  const query = params.toString();
  return query ? `?${query}` : "";
}

function matches(item: InboxItem, target: InboxTarget) {
  if (target.all) return true;
  if (target.ids?.includes(item.id)) return true;
  return Boolean(item.groupKey && target.groupKeys?.includes(item.groupKey));
}

function applyState(item: InboxItem, action: InboxStateAction, now: string): InboxItem {
  switch (action) {
    case "read":
      return { ...item, readAt: item.readAt ?? now };
    case "unread":
      return { ...item, readAt: null };
    case "done":
      return { ...item, doneAt: item.doneAt ?? now, readAt: item.readAt ?? now };
    case "undone":
      return { ...item, doneAt: null };
    case "archive":
      return { ...item, archivedAt: now, readAt: item.readAt ?? now };
    case "unarchive":
      return { ...item, archivedAt: null };
  }
}

/**
 * Posteingang laden und ändern. Änderungen werden sofort angezeigt und im Hintergrund
 * gespeichert; neue Benachrichtigungen (Realtime) und Fokuswechsel laden neu.
 */
export function useInbox(filter: InboxFilter, options: { enabled?: boolean } = {}) {
  const enabled = options.enabled ?? true;
  const [items, setItems] = useState<InboxItem[]>([]);
  const [counts, setCounts] = useState<InboxCounts>(EMPTY_COUNTS);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hints, setHints] = useState<InboxResponse["hints"]>({});
  const requestId = useRef(0);

  const query = buildQuery(filter);

  const reload = useCallback(async () => {
    if (!enabled) return;
    const id = ++requestId.current;
    setLoading(true);
    try {
      const response = await fetch(`/api/notifications${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as InboxResponse;
      if (id !== requestId.current) return;
      setItems(data.items);
      setCounts(data.counts);
      setNextCursor(data.nextCursor);
      setHints(data.hints ?? {});
      setLoaded(true);
    } catch (error) {
      if (id === requestId.current) {
        console.error("[useInbox] load failed", error);
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [enabled, query]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    try {
      const response = await fetch(`/api/notifications${buildQuery(filter, nextCursor)}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as InboxResponse;
      setItems((previous) => {
        const known = new Set(previous.map((item) => item.id));
        return [...previous, ...data.items.filter((item) => !known.has(item.id))];
      });
      setCounts(data.counts);
      setNextCursor(data.nextCursor);
    } catch (error) {
      console.error("[useInbox] loadMore failed", error);
      toast.error("Weitere Benachrichtigungen konnten nicht geladen werden.");
    }
  }, [filter, nextCursor]);

  const update = useCallback(
    async (action: InboxStateAction, target: InboxTarget) => {
      if (!target.all && !target.ids?.length && !target.groupKeys?.length) return;
      const now = new Date().toISOString();
      setItems((previous) => {
        const next = previous.map((item) =>
          matches(item, target) ? applyState(item, action, now) : item,
        );
        // Aus der aktuellen Ansicht fallen archivierte bzw. zurückgeholte Einträge heraus.
        if (action === "archive" && !filter.archived) return next.filter((i) => !i.archivedAt);
        if (action === "unarchive" && filter.archived) return next.filter((i) => i.archivedAt);
        return next;
      });
      try {
        const response = await fetch("/api/notifications/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            ...target,
            category: target.all ? filter.category : undefined,
          }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        console.error("[useInbox] update failed", error);
        toast.error("Das hat nicht geklappt. Bitte erneut versuchen.");
      }
      void reload();
    },
    [filter.archived, filter.category, reload],
  );

  useEffect(() => {
    // Laden bei Filterwechsel; der Zustand wird erst nach der Antwort gesetzt.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [enabled, reload]);

  const onRealtime = useCallback(() => void reload(), [reload]);
  useNotificationRealtime(onRealtime);

  const groups = useMemo(() => groupInboxItems(items), [items]);

  return { items, groups, counts, nextCursor, loading, loaded, hints, reload, loadMore, update };
}
