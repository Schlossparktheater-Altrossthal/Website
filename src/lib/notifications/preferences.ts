import type { NotificationCategory, NotificationKind, NotificationPriority } from "./types";

export type PushPreference = { category: string; push: boolean };

/**
 * Soll ein Eintrag per Push kommen? Dringendes immer; sonst die eigene Wahl je Kategorie,
 * ohne Wahl nur, wenn etwas zu tun ist.
 */
export function shouldPush(
  notification: {
    category: NotificationCategory;
    kind: NotificationKind;
    priority: NotificationPriority;
  },
  preference: PushPreference | undefined,
) {
  if (notification.priority === "urgent") return true;
  if (preference) return preference.push;
  return notification.kind === "action";
}
