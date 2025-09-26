import { cookies } from "next/headers";
import type { Session } from "next-auth";

import { prisma } from "@/lib/prisma";
import { combineNameParts } from "@/lib/names";
import { sortRoles, type Role } from "@/lib/roles";

const IMPERSONATION_COOKIE_NAME = "member_impersonation";

export type ImpersonationDetails = {
  active: boolean;
  owner: {
    id: string;
    name: string | null;
  };
  target: {
    id: string;
    name: string | null;
    role: Role | null;
    roles: Role[];
    email: string | null;
  };
  startedAt: string | null;
};

type ImpersonationCookiePayload = {
  ownerId: string;
  targetId: string;
  startedAt: string;
};

function encodeCookiePayload(payload: ImpersonationCookiePayload) {
  return Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
}

function decodeCookiePayload(value: string): ImpersonationCookiePayload | null {
  try {
    const json = Buffer.from(value, "base64url").toString("utf-8");
    const parsed = JSON.parse(json);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.ownerId === "string" &&
      typeof parsed.targetId === "string" &&
      typeof parsed.startedAt === "string"
    ) {
      return {
        ownerId: parsed.ownerId,
        targetId: parsed.targetId,
        startedAt: parsed.startedAt,
      } satisfies ImpersonationCookiePayload;
    }
  } catch (error) {
    console.error("[impersonation] Failed to decode cookie", error);
  }
  return null;
}

function userHasOwnerRole(user: { role?: Role | null; roles?: Role[] | null } | null | undefined) {
  if (!user) {
    return false;
  }
  if (user.role === "owner") {
    return true;
  }
  if (Array.isArray(user.roles)) {
    return user.roles.includes("owner");
  }
  return false;
}

async function getRequestCookies() {
  try {
    return await cookies();
  } catch {
    return null;
  }
}

export async function setImpersonationCookie(ownerId: string, targetId: string) {
  const store = await getRequestCookies();
  if (!store) {
    return;
  }
  const payload: ImpersonationCookiePayload = {
    ownerId,
    targetId,
    startedAt: new Date().toISOString(),
  };
  store.set({
    name: IMPERSONATION_COOKIE_NAME,
    value: encodeCookiePayload(payload),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 2, // two hours
  });
}

export async function clearImpersonationCookie() {
  const store = await getRequestCookies();
  if (!store) {
    return;
  }
  store.delete(IMPERSONATION_COOKIE_NAME);
}

export async function applyImpersonation(
  session: Session | null,
  allowImpersonation = true,
): Promise<Session | null> {
  if (!session) {
    return session;
  }

  const baseSession: Session = { ...session, impersonation: null };

  if (!allowImpersonation || !session.user?.id) {
    return baseSession;
  }

  const store = await getRequestCookies();
  if (!store) {
    return baseSession;
  }
  const rawCookie = store.get(IMPERSONATION_COOKIE_NAME)?.value ?? null;
  if (!rawCookie) {
    return baseSession;
  }

  const payload = decodeCookiePayload(rawCookie);
  if (!payload) {
    store.delete(IMPERSONATION_COOKIE_NAME);
    return baseSession;
  }

  if (payload.ownerId !== session.user.id) {
    store.delete(IMPERSONATION_COOKIE_NAME);
    return baseSession;
  }

  if (!userHasOwnerRole(session.user)) {
    store.delete(IMPERSONATION_COOKIE_NAME);
    return baseSession;
  }

  if (payload.targetId === payload.ownerId) {
    store.delete(IMPERSONATION_COOKIE_NAME);
    return baseSession;
  }

  const target = await prisma.user.findUnique({
    where: { id: payload.targetId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      name: true,
      email: true,
      role: true,
      roles: { select: { role: true } },
      avatarSource: true,
      avatarImageUpdatedAt: true,
      dateOfBirth: true,
      deactivatedAt: true,
    },
  });

  if (!target) {
    store.delete(IMPERSONATION_COOKIE_NAME);
    return baseSession;
  }

  const combinedRoles = sortRoles([
    target.role as Role,
    ...target.roles.map((entry) => entry.role as Role),
  ]);
  const primaryRole = combinedRoles[combinedRoles.length - 1] ?? null;

  const targetFullName =
    combineNameParts(target.firstName, target.lastName) ??
    (typeof target.name === "string" && target.name.trim().length > 0 ? target.name : null) ??
    (typeof target.email === "string" && target.email.trim().length > 0 ? target.email : null) ??
    target.id;

  const ownerFullName =
    combineNameParts(session.user.firstName, session.user.lastName) ??
    (typeof session.user.name === "string" && session.user.name.trim().length > 0
      ? session.user.name
      : null) ??
    (typeof session.user.email === "string" && session.user.email.trim().length > 0
      ? session.user.email
      : null) ??
    session.user.id;

  const impersonatedSession: Session = {
    ...session,
    user: {
      ...session.user,
      id: target.id,
      firstName: target.firstName ?? null,
      lastName: target.lastName ?? null,
      name: combineNameParts(target.firstName, target.lastName) ?? target.name ?? null,
      email: target.email ?? null,
      role: primaryRole ?? undefined,
      roles: combinedRoles,
      avatarSource: target.avatarSource ?? null,
      avatarUpdatedAt: target.avatarImageUpdatedAt?.toISOString() ?? null,
      dateOfBirth: target.dateOfBirth?.toISOString() ?? null,
      isDeactivated: Boolean(target.deactivatedAt),
      deactivatedAt: target.deactivatedAt?.toISOString() ?? null,
    },
    impersonation: {
      active: true,
      owner: {
        id: session.user.id,
        name: ownerFullName,
      },
      target: {
        id: target.id,
        name: targetFullName,
        role: primaryRole,
        roles: combinedRoles,
        email: target.email ?? null,
      },
      startedAt: payload.startedAt ?? null,
    },
  } satisfies Session;

  return impersonatedSession;
}

export function hasActiveImpersonation(
  session: Session | null,
): session is Session & { impersonation: ImpersonationDetails } {
  return Boolean(session?.impersonation?.active);
}

