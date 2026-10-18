import type { AxisPoint } from "./axis";

/**
 * Eine Person, mehrere Geräte (docs/Plan/skript-mitlesen-plan.md, Phase 2): Teilen zwei Geräte
 * derselben Person ihre Stelle, bleiben Folgende beim gerade aktiven Gerät. Gewechselt wird erst,
 * wenn es eine Weile nichts mehr gesendet hat – sonst springt der Leser zwischen beiden Stellen.
 */

export const DEVICE_SWITCH_AFTER_MS = 5000;

export type LeaderPoint = AxisPoint & { deviceId: string; at: number };

export function acceptLeaderPoint(known: LeaderPoint | null, next: LeaderPoint): boolean {
  if (!known) return true;
  if (next.at < known.at) return false;
  if (known.deviceId === next.deviceId) return true;
  return next.at - known.at >= DEVICE_SWITCH_AFTER_MS;
}
