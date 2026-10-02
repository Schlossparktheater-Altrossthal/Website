import type { OfflineScope } from "./types";

export function inferScopeFromEventType(_type: string): OfflineScope {
  return "tickets";
}
