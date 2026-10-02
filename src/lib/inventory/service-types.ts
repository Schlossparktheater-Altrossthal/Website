/** Ziel beim Einlagern – client-sicher, ohne Server-Abhängigkeiten. */
export type PlacementTarget =
  { type: "location"; id: string } | { type: "container"; id: string } | { type: "none" };
