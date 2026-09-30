import type { AvatarSource } from "@prisma/client";

/**
 * Nutzerzeile aus Prisma, aus der sich die Avatar-Felder ableiten. Passt zum
 * `select` aus `AVATAR_USER_SELECT`.
 */
export type AvatarUserSource = {
  email: string | null;
  avatarSource: AvatarSource | null;
  avatarImageUpdatedAt: Date | null;
};

/**
 * Felder, die `UserAvatar` braucht, um das festgelegte Bild einer Person zu zeigen
 * statt nur deren Initialen.
 */
export type AvatarFields = {
  email: string | null;
  avatarSource: AvatarSource | null;
  avatarUpdatedAt: Date | null;
};

/** Prisma-`select` für die Avatar-Quelldaten eines Nutzers. */
export const AVATAR_USER_SELECT = {
  email: true,
  avatarSource: true,
  avatarImageUpdatedAt: true,
} as const;

/** Bildet die Prisma-Auswahl auf die Props von `UserAvatar` ab. */
export function toAvatarFields(user: AvatarUserSource): AvatarFields {
  return {
    email: user.email,
    avatarSource: user.avatarSource,
    avatarUpdatedAt: user.avatarImageUpdatedAt,
  };
}
