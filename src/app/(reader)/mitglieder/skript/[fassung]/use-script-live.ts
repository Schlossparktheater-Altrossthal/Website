"use client";

import * as React from "react";

import { useRealtime } from "@/hooks/useRealtime";
import type { AxisPoint } from "@/lib/skript/live/axis";
import type { ScriptLiveLeader, ScriptLiveRosterEvent } from "@/lib/realtime/types";

/**
 * Raum fürs Live-Mitlesen je Fassung (docs/Plan/skript-mitlesen-plan.md, Phase 2). Nur aktiv,
 * solange `enabled` (Mitlesen wird nie automatisch eingeschaltet, E6). Positionen anderer kommen
 * nur von Personen, die „Andere dürfen mir folgen“ eingeschaltet haben.
 */

/** Höchstens eine Position pro Sekunde senden. */
const SEND_INTERVAL_MS = 1000;

export type LeaderPoint = AxisPoint & { at: number };

export function useScriptLive({
  versionId,
  enabled,
  followable,
  ownPoint,
}: {
  versionId: string;
  enabled: boolean;
  followable: boolean;
  /** Eigene Lesestelle, wird bei `followable` regelmäßig geteilt. */
  ownPoint: () => AxisPoint;
}) {
  const { socket, connectionStatus } = useRealtime();
  const [roster, setRoster] = React.useState<ScriptLiveRosterEvent | null>(null);
  /** Letzte Stelle je führender Person (Ref: ändert sich bis zu 1×/s, ohne Neuzeichnen). */
  const points = React.useRef(new Map<string, LeaderPoint>());
  const followableRef = React.useRef(followable);
  const pointRef = React.useRef(ownPoint);
  React.useEffect(() => {
    pointRef.current = ownPoint;
  });

  React.useEffect(() => {
    if (!socket || !enabled) return;
    const join = () =>
      socket.emit("script_live_join", { versionId, followable: followableRef.current });
    const onRoster = (event: ScriptLiveRosterEvent) => {
      if (event.versionId !== versionId) return;
      for (const leader of event.leaders) {
        const known = points.current.get(leader.userId);
        if (leader.index === null || leader.fraction === null || leader.at === null) continue;
        if (known && known.at >= leader.at) continue;
        points.current.set(leader.userId, {
          index: leader.index,
          fraction: leader.fraction,
          at: leader.at,
        });
      }
      setRoster(event);
    };
    const onPosition = (event: { userId: string; index: number; fraction: number; at: number }) => {
      points.current.set(event.userId, {
        index: event.index,
        fraction: event.fraction,
        at: event.at,
      });
    };
    socket.on("script_live_roster", onRoster);
    socket.on("script_live_position", onPosition);
    // Nach Verbindungsabbruch neu beitreten (der Server vergisst den Raum).
    socket.on("connect", join);
    if (socket.connected) join();
    return () => {
      socket.off("script_live_roster", onRoster);
      socket.off("script_live_position", onPosition);
      socket.off("connect", join);
      if (socket.connected) socket.emit("script_live_leave");
      setRoster(null);
      points.current.clear();
    };
  }, [socket, enabled, versionId]);

  React.useEffect(() => {
    followableRef.current = followable;
    if (socket?.connected && enabled) socket.emit("script_live_update", { followable });
  }, [socket, enabled, followable]);

  // Eigene Stelle teilen, nur bei Änderung.
  React.useEffect(() => {
    if (!socket || !enabled || !followable) return;
    let last = "";
    const timer = window.setInterval(() => {
      if (!socket.connected) return;
      const point = pointRef.current();
      const key = `${point.index}:${point.fraction.toFixed(3)}`;
      if (key === last) return;
      last = key;
      socket.emit("script_live_position", { index: point.index, fraction: point.fraction });
    }, SEND_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [socket, enabled, followable]);

  const leaderPoint = React.useCallback((userId: string) => points.current.get(userId) ?? null, []);

  const ownId = (socket?.auth as { userId?: string } | undefined)?.userId ?? null;
  return {
    connected: connectionStatus === "connected",
    readers: roster?.readers ?? 0,
    /** Andere Personen, denen man folgen kann (ohne sich selbst). */
    leaders: (roster?.leaders ?? ([] as ScriptLiveLeader[])).filter(
      (leader) => leader.userId !== ownId,
    ),
    leaderPoint,
  };
}
