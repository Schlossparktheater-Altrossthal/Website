import type { OfflineScope } from "./types";

export function inferScopeFromEventType(type: string): OfflineScope {
  return type.startsWith("inventory") ? "inventory" : "tickets";
}
