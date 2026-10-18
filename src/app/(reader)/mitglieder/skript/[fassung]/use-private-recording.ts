"use client";

import * as React from "react";

import {
  startPrivateRecordingAction,
  stopRecordingAction,
  uploadPrivateSamplesAction,
} from "../session-actions";

/**
 * Private Aufnahme (docs/Plan/skript-mitlesen-plan.md, E11): alle 5 s die eigene Lesestelle
 * festhalten, im localStorage puffern (übersteht Neuladen und fehlendes Netz) und alle 30 s
 * hochladen. Beenden lädt den Rest hoch und schließt die Aufnahme – notfalls später.
 */

export const SAMPLE_MS = 5_000;
const UPLOAD_MS = 30_000;
/** Weniger Bewegung zwischen zwei Messpunkten = nicht aktiv. */
const MOVE_CHARS = 15;
const MAX_BATCH = 500;

type Sample = { at: number; pos: number; active: number };
type Stored = { sessionId: string; startedAt: number; pending: Sample[]; stopped?: boolean };

const key = (versionId: string) => `skript-rec:${versionId}`;

function read(versionId: string): Stored | null {
  try {
    const raw = window.localStorage.getItem(key(versionId));
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

function write(versionId: string, value: Stored | null) {
  try {
    if (value) window.localStorage.setItem(key(versionId), JSON.stringify(value));
    else window.localStorage.removeItem(key(versionId));
  } catch {
    // Speicher voll – Messpunkte gehen dann verloren, die Aufnahme läuft weiter.
  }
}

export function usePrivateRecording({
  versionId,
  position,
}: {
  versionId: string;
  /** Eigene Stelle auf der Achse (live/axis.ts). */
  position: () => number;
}) {
  const [state, setState] = React.useState<{ sessionId: string; startedAt: number } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const positionRef = React.useRef(position);
  React.useEffect(() => {
    positionRef.current = position;
  });
  const syncing = React.useRef(false);

  /** Puffer hochladen; beendete Aufnahme danach schließen. */
  const sync = React.useCallback(async () => {
    if (syncing.current || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
    syncing.current = true;
    try {
      for (;;) {
        const stored = read(versionId);
        if (!stored) return;
        if (stored.pending.length) {
          const batch = stored.pending.slice(0, MAX_BATCH);
          const result = await uploadPrivateSamplesAction({
            sessionId: stored.sessionId,
            samples: batch,
          });
          if (!result.ok) {
            // Aufnahme gibt es nicht mehr (gelöscht) → Puffer verwerfen.
            if (result.error === "Aufnahme nicht gefunden.") write(versionId, null);
            return;
          }
          const latest = read(versionId);
          if (!latest || latest.sessionId !== stored.sessionId) return;
          const sent = new Set(batch.map((sample) => sample.at));
          write(versionId, {
            ...latest,
            pending: latest.pending.filter((sample) => !sent.has(sample.at)),
          });
          continue;
        }
        if (stored.stopped) {
          const result = await stopRecordingAction({ sessionId: stored.sessionId });
          if (result.ok || result.error === "Aufnahme nicht gefunden.") write(versionId, null);
        }
        return;
      }
    } finally {
      syncing.current = false;
    }
  }, [versionId]);

  // Beim Öffnen: laufende Aufnahme fortsetzen, liegen gebliebene Reste nachsenden.
  React.useEffect(() => {
    const stored = read(versionId);
    setState(
      stored && !stored.stopped
        ? { sessionId: stored.sessionId, startedAt: stored.startedAt }
        : null,
    );
    void sync();
    const online = () => void sync();
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [versionId, sync]);

  React.useEffect(() => {
    if (!state) return;
    let last = Number.NaN;
    const sample = () => {
      const pos = positionRef.current();
      if (!Number.isFinite(pos)) return;
      const stored = read(versionId);
      if (!stored || stored.sessionId !== state.sessionId || stored.stopped) return;
      const active = Number.isFinite(last) && Math.abs(pos - last) >= MOVE_CHARS ? 1 : 0;
      last = pos;
      stored.pending.push({ at: Date.now(), pos: Math.round(pos * 10) / 10, active });
      write(versionId, stored);
    };
    sample();
    const sampler = window.setInterval(sample, SAMPLE_MS);
    const uploader = window.setInterval(() => void sync(), UPLOAD_MS);
    // Beim Verlassen der Seite den letzten Stand sichern.
    const hide = () => {
      if (document.visibilityState === "hidden") void sync();
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.clearInterval(sampler);
      window.clearInterval(uploader);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [state, versionId, sync]);

  const start = React.useCallback(async () => {
    setBusy(true);
    try {
      const result = await startPrivateRecordingAction({ versionId });
      if (!result.ok || !result.sessionId) {
        return result.ok ? "Aufnahme konnte nicht starten." : result.error;
      }
      const startedAt = result.startedAt ?? Date.now();
      const stored = read(versionId);
      write(versionId, {
        sessionId: result.sessionId,
        startedAt,
        pending: stored?.sessionId === result.sessionId ? stored.pending : [],
      });
      setState({ sessionId: result.sessionId, startedAt });
      return null;
    } finally {
      setBusy(false);
    }
  }, [versionId]);

  const stop = React.useCallback(async () => {
    const stored = read(versionId);
    setState(null);
    if (!stored) return null;
    const pos = positionRef.current();
    if (Number.isFinite(pos)) stored.pending.push({ at: Date.now(), pos, active: 0 });
    write(versionId, { ...stored, stopped: true });
    setBusy(true);
    try {
      await sync();
    } finally {
      setBusy(false);
    }
    return stored.sessionId;
  }, [versionId, sync]);

  return { recording: state, busy, start, stop };
}
