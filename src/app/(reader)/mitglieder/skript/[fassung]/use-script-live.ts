"use client";

import * as React from "react";

import { useRealtime } from "@/hooks/useRealtime";
import type { AxisPoint } from "@/lib/skript/live/axis";
import type {
  ScriptLiveLeader,
  ScriptLiveEstimateEvent,
  ScriptLivePositionEvent,
  ScriptLiveRosterEvent,
  ScriptLiveStatusEvent,
} from "@/lib/realtime/types";
import { acceptLeaderPoint, type LeaderPoint } from "@/lib/skript/live/devices";

/**
 * Raum fürs Live-Mitlesen je Fassung (docs/Plan/skript-mitlesen-plan.md, Phase 2). Nur aktiv,
 * solange `enabled` (Mitlesen wird nie automatisch eingeschaltet, E6). Positionen anderer kommen
 * nur von Personen, die „Andere dürfen mir folgen“ eingeschaltet haben.
 */

/** Höchstens eine Position pro Sekunde senden. */
const SEND_INTERVAL_MS = 1000;

export function useScriptLive({
  versionId,
  enabled,
  followable,
  ownPoint,
}: {
  versionId: string;
  enabled: boolean;
  followable: boolean;
  /**
   * Eigene Lesestelle; wird geteilt, solange man mitliest. `pos` = Achsen-Position für die
   * Schätzung, `echo` = der Leser folgt gerade selbst (zählt dann nicht für die Schätzung).
   */
  ownPoint: () => AxisPoint & { pos: number; echo: boolean; cps?: number };
}) {
  const { socket, connectionStatus } = useRealtime();
  const [roster, setRoster] = React.useState<ScriptLiveRosterEvent | null>(null);
  /** Statistische Live-Stelle vom Server (Phase 3); `received` = lokale Empfangszeit. */
  const estimateRef = React.useRef<(ScriptLiveEstimateEvent & { received: number }) | null>(null);
  /** Nur für Führende: wer ist abgehängt (E7). */
  const [status, setStatus] = React.useState<ScriptLiveStatusEvent | null>(null);
  const [estimateInfo, setEstimateInfo] = React.useState({ confident: false, active: 0 });
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
    const store = (event: ScriptLivePositionEvent) => {
      const next: LeaderPoint = {
        deviceId: event.deviceId,
        index: event.index,
        fraction: event.fraction,
        at: event.at,
      };
      const known = points.current.get(event.userId) ?? null;
      if (acceptLeaderPoint(known, next)) points.current.set(event.userId, next);
    };
    const onRoster = (event: ScriptLiveRosterEvent) => {
      if (event.versionId !== versionId) return;
      for (const leader of event.leaders) {
        if (leader.index === null || leader.fraction === null || leader.at === null) continue;
        store({ ...leader, index: leader.index, fraction: leader.fraction, at: leader.at });
      }
      setRoster(event);
    };
    const onPosition = (event: ScriptLivePositionEvent) => store(event);
    const onEstimate = (event: ScriptLiveEstimateEvent) => {
      if (event.versionId !== versionId) return;
      estimateRef.current = { ...event, received: performance.now() };
      setEstimateInfo((current) =>
        current.confident === event.confident && current.active === event.active
          ? current
          : { confident: event.confident, active: event.active },
      );
    };
    const onStatus = (event: ScriptLiveStatusEvent) => {
      if (event.versionId === versionId) setStatus(event);
    };
    socket.on("script_live_status", onStatus);
    socket.on("script_live_estimate", onEstimate);
    socket.on("script_live_roster", onRoster);
    socket.on("script_live_position", onPosition);
    // Nach Verbindungsabbruch neu beitreten (der Server vergisst den Raum).
    socket.on("connect", join);
    if (socket.connected) join();
    return () => {
      socket.off("script_live_status", onStatus);
      socket.off("script_live_estimate", onEstimate);
      socket.off("script_live_roster", onRoster);
      socket.off("script_live_position", onPosition);
      socket.off("connect", join);
      if (socket.connected) socket.emit("script_live_leave");
      setRoster(null);
      setStatus(null);
      points.current.clear();
      estimateRef.current = null;
      setEstimateInfo({ confident: false, active: 0 });
    };
  }, [socket, enabled, versionId]);

  React.useEffect(() => {
    followableRef.current = followable;
    if (socket?.connected && enabled) socket.emit("script_live_update", { followable });
  }, [socket, enabled, followable]);

  // Eigene Stelle teilen, nur bei Änderung. Alle Mitlesenden senden (anonym für die Schätzung);
  // an andere weitergegeben wird sie nur bei „Andere dürfen mir folgen“ (Server).
  React.useEffect(() => {
    if (!socket || !enabled) return;
    let last = "";
    const timer = window.setInterval(() => {
      if (!socket.connected) return;
      const point = pointRef.current();
      const key = `${point.index}:${point.fraction.toFixed(3)}:${point.echo}`;
      if (key === last) return;
      last = key;
      socket.emit("script_live_position", point);
    }, SEND_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [socket, enabled]);

  /** Live-Stelle jetzt: letzte Schätzung + Tempo seit Empfang (höchstens 2 s weiterrechnen). */
  const estimatePosition = React.useCallback((now: number) => {
    const current = estimateRef.current;
    if (!current || !current.confident) return Number.NaN;
    const seconds = Math.min(2, Math.max(0, (now - current.received) / 1000));
    return current.pos + current.rate * seconds;
  }, []);

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
    estimatePosition,
    /** Genug Mitlesende für eine sichere Schätzung? */
    estimateConfident: estimateInfo.confident,
    estimateActive: estimateInfo.active,
    /** Wer folgt, mitliest, abgehängt ist – nur solange man selbst folgbar ist. */
    status: followable ? status : null,
  };
}
