import { cookies } from "next/headers";
import { cache } from "react";

import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/rbac";

import { encryptSecretToken, generateSecretToken, hashSecretToken } from "./codes";
import { TICKET_PERMISSION_KEYS } from "./constants";

export const BOX_OFFICE_COOKIE = "kartenbuero";
/** Standard-Laufzeit eines Kartenbüro-Zugangs. */
export const BOX_OFFICE_DEFAULT_DAYS = 120;

export type TicketCapability = "manage" | "office" | "checkIn";

/**
 * Wer gerade Karten verwaltet: ein Mitglied mit Rechten oder ein Kartenbüro-Zugang ohne Konto
 * (z. B. die Sekretärin). Zugänge sind auf eine Produktion beschränkt, wenn `showId` gesetzt ist.
 */
export type TicketActor =
  | {
      kind: "member";
      userId: string;
      name: string;
      canManage: boolean;
      canOffice: boolean;
      canCheckIn: boolean;
      /** Zusätzlich per Kartenbüro-Link angemeldet (Rechte werden zusammengeführt). */
      accessId?: string;
    }
  | {
      kind: "access";
      accessId: string;
      name: string;
      showId: string | null;
      canManage: false;
      canOffice: boolean;
      canCheckIn: boolean;
    };

export function actorCan(actor: TicketActor | null, capability: TicketCapability): boolean {
  if (!actor) return false;
  if (capability === "manage") return actor.canManage;
  if (capability === "office") return actor.canOffice;
  return actor.canCheckIn;
}

export function actorMayAccessShow(actor: TicketActor, showId: string): boolean {
  return actor.kind === "member" || actor.showId === null || actor.showId === showId;
}

export function actorRef(actor: TicketActor) {
  return actor.kind === "member" ? { userId: actor.userId } : { accessId: actor.accessId };
}

async function loadMemberActor(): Promise<TicketActor | null> {
  const session = await getSession().catch(() => null);
  const user = session?.user;
  if (!user?.id || user.isDeactivated) return null;
  const [manage, office, checkIn] = await Promise.all([
    hasPermission(user, TICKET_PERMISSION_KEYS.manage),
    hasPermission(user, TICKET_PERMISSION_KEYS.office),
    hasPermission(user, TICKET_PERMISSION_KEYS.checkIn),
  ]);
  if (!manage && !office && !checkIn) return null;
  return {
    kind: "member",
    userId: user.id,
    name: user.name ?? user.email ?? "Mitglied",
    canManage: manage,
    canOffice: manage || office,
    canCheckIn: manage || checkIn,
  };
}

export async function findUsableAccess(token: string, now: Date = new Date()) {
  const access = await prisma.boxOfficeAccess.findUnique({
    where: { tokenHash: hashSecretToken(token) },
  });
  if (!access || access.revokedAt || access.expiresAt <= now) return null;
  return access;
}

async function loadAccessActor(): Promise<TicketActor | null> {
  const store = await cookies();
  const token = store.get(BOX_OFFICE_COOKIE)?.value;
  if (!token) return null;
  const access = await findUsableAccess(token);
  if (!access) return null;
  const now = new Date();
  // Höchstens alle 10 Minuten schreiben.
  if (!access.lastUsedAt || now.getTime() - access.lastUsedAt.getTime() > 10 * 60_000) {
    await prisma.boxOfficeAccess.update({ where: { id: access.id }, data: { lastUsedAt: now } });
  }
  return {
    kind: "access",
    accessId: access.id,
    name: access.name,
    showId: access.showId,
    canManage: false,
    canOffice: access.canOffice,
    canCheckIn: access.canCheckIn,
  };
}

/**
 * Mitglieder-Sitzung hat Vorrang; sonst Kartenbüro-Cookie. Öffnet ein angemeldetes Mitglied einen
 * Zugangslink (z. B. den Einlass-QR), gelten die Rechte aus beiden zusammen – sonst würde das
 * Mitgliedskonto die Rechte des Links verdecken.
 */
export const getTicketActor = cache(async (): Promise<TicketActor | null> => {
  const [member, access] = await Promise.all([loadMemberActor(), loadAccessActor()]);
  if (member?.kind === "member" && access?.kind === "access") {
    return {
      ...member,
      canOffice: member.canOffice || access.canOffice,
      canCheckIn: member.canCheckIn || access.canCheckIn,
      accessId: access.accessId,
    };
  }
  return member ?? access;
});

export class TicketAccessError extends Error {
  constructor(message = "Keine Berechtigung.") {
    super(message);
    this.name = "TicketAccessError";
  }
}

export async function requireTicketActor(
  capability: TicketCapability,
  showId?: string | null,
): Promise<TicketActor> {
  const actor = await getTicketActor();
  if (!actor || !actorCan(actor, capability)) throw new TicketAccessError();
  if (showId && !actorMayAccessShow(actor, showId)) throw new TicketAccessError();
  return actor;
}

export async function createBoxOfficeAccess(input: {
  name: string;
  email: string;
  showId: string | null;
  canOffice: boolean;
  canCheckIn: boolean;
  expiresAt: Date;
  createdById: string;
}) {
  const token = generateSecretToken();
  const access = await prisma.boxOfficeAccess.create({
    data: {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      showId: input.showId,
      canOffice: input.canOffice,
      canCheckIn: input.canCheckIn,
      expiresAt: input.expiresAt,
      createdById: input.createdById,
      tokenHash: hashSecretToken(token),
      tokenEnc: encryptSecretToken(token),
    },
  });
  return { access, token };
}

/** Neuer Link für einen bestehenden Zugang; der alte Link und angemeldete Geräte verlieren ihn. */
export async function rotateBoxOfficeAccessToken(accessId: string) {
  const token = generateSecretToken();
  const access = await prisma.boxOfficeAccess.update({
    where: { id: accessId },
    data: {
      tokenHash: hashSecretToken(token),
      tokenEnc: encryptSecretToken(token),
      revokedAt: null,
    },
  });
  return { access, token };
}
