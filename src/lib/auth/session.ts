import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

const MEMBER_ROLES = new Set<Role>([
  "member",
  "cast",
  "tech",
  "board",
  "finance",
  "owner",
  "admin",
]);

function isDatabaseEnabled() {
  return Boolean(process.env.DATABASE_URL);
}

function determineMembership(roles: Role[] | undefined) {
  if (!roles || roles.length === 0) {
    return { isMember: false, membershipRole: null as string | null };
  }

  const normalized = roles.filter((role): role is Role => MEMBER_ROLES.has(role));
  if (normalized.length === 0) {
    return { isMember: false, membershipRole: null as string | null };
  }

  const membershipRole = normalized[normalized.length - 1];
  return { isMember: true, membershipRole };
}

function sanitizePath(path: string | null | undefined): string | null {
  if (typeof path !== "string") {
    return null;
  }
  let normalized = path.trim();
  if (!normalized) {
    return null;
  }
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  normalized = normalized.replace(/\\+/g, "/");
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  if (normalized.length > 512) {
    normalized = normalized.slice(0, 512);
  }
  return normalized;
}

type SessionIdentifier =
  | { analyticsSessionId: string }
  | { userId: string }
  | { analyticsSessionId: string; userId?: string };

async function resolveActiveSessionId(identifier: SessionIdentifier) {
  if ("analyticsSessionId" in identifier && identifier.analyticsSessionId) {
    return identifier.analyticsSessionId;
  }

  if ("userId" in identifier && identifier.userId) {
    const session = await prisma.analyticsSession.findFirst({
      where: {
        userId: identifier.userId,
        endedAt: null,
      },
      orderBy: { lastSeenAt: "desc" },
    });
    return session?.id ?? null;
  }

  return null;
}

export async function recordSessionStart({
  analyticsSessionId,
  userId,
  roles,
  startedAt,
  initialPath,
}: {
  analyticsSessionId: string | null | undefined;
  userId?: string | null;
  roles?: Role[] | null;
  startedAt?: Date;
  initialPath?: string | null;
}) {
  if (!isDatabaseEnabled()) {
    return;
  }

  if (typeof analyticsSessionId !== "string" || analyticsSessionId.length < 6) {
    return;
  }

  const now = startedAt ?? new Date();
  const { isMember, membershipRole } = determineMembership(roles ?? undefined);
  const sanitizedPath = sanitizePath(initialPath);

  try {
    await prisma.analyticsSession.upsert({
      where: { id: analyticsSessionId },
      create: {
        id: analyticsSessionId,
        userId: userId ?? null,
        membershipRole,
        isMember,
        startedAt: now,
        lastSeenAt: now,
        pagePaths: sanitizedPath ? [sanitizedPath] : [],
      },
      update: {
        userId: userId ?? null,
        membershipRole,
        isMember,
        lastSeenAt: now,
        endedAt: null,
        durationSeconds: null,
        ...(sanitizedPath ? { pagePaths: { push: sanitizedPath } } : {}),
      },
    });
  } catch (error) {
    console.error("[analytics] Failed to record session start", error);
  }
}

export async function recordSessionHeartbeat(
  identifier: SessionIdentifier,
  seenAt: Date = new Date(),
) {
  if (!isDatabaseEnabled()) {
    return;
  }

  try {
    const sessionId = await resolveActiveSessionId(identifier);
    if (!sessionId) {
      return;
    }

    await prisma.analyticsSession.update({
      where: { id: sessionId },
      data: {
        lastSeenAt: seenAt,
      },
    });
  } catch (error) {
    console.error("[analytics] Failed to update session heartbeat", error);
  }
}

export async function recordSessionPath(
  identifier: SessionIdentifier,
  path: string | null | undefined,
  seenAt: Date = new Date(),
) {
  if (!isDatabaseEnabled()) {
    return;
  }

  const sanitizedPath = sanitizePath(path);
  if (!sanitizedPath) {
    await recordSessionHeartbeat(identifier, seenAt);
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const sessionId = await resolveActiveSessionId(identifier);
      if (!sessionId) {
        return;
      }

      const existing = await tx.analyticsSession.findUnique({
        where: { id: sessionId },
        select: { pagePaths: true },
      });
      if (!existing) {
        return;
      }

      const pages = new Set(existing.pagePaths ?? []);
      pages.add(sanitizedPath);

      await tx.analyticsSession.update({
        where: { id: sessionId },
        data: {
          lastSeenAt: seenAt,
          pagePaths: { set: Array.from(pages).slice(-50) },
        },
      });
    });
  } catch (error) {
    console.error("[analytics] Failed to record session path", error);
  }
}

export async function recordSessionEnd({
  analyticsSessionId,
  endedAt,
}: {
  analyticsSessionId: string | null | undefined;
  endedAt?: Date;
}) {
  if (!isDatabaseEnabled()) {
    return;
  }

  if (typeof analyticsSessionId !== "string" || analyticsSessionId.length < 6) {
    return;
  }

  try {
    const session = await prisma.analyticsSession.findUnique({
      where: { id: analyticsSessionId },
      select: { startedAt: true, lastSeenAt: true },
    });

    if (!session) {
      return;
    }

    const endTime = endedAt ?? new Date();
    const referenceTime = session.lastSeenAt && session.lastSeenAt > endTime ? session.lastSeenAt : endTime;
    const durationMs = Math.max(0, referenceTime.getTime() - session.startedAt.getTime());
    const durationSeconds = Math.round(durationMs / 1000);

    await prisma.analyticsSession.update({
      where: { id: analyticsSessionId },
      data: {
        endedAt: endTime,
        lastSeenAt: referenceTime,
        durationSeconds,
      },
    });
  } catch (error) {
    console.error("[analytics] Failed to record session end", error);
  }
}

export async function attachUserToSession({
  analyticsSessionId,
  userId,
  roles,
}: {
  analyticsSessionId: string | null | undefined;
  userId?: string | null;
  roles?: Role[] | null;
}) {
  if (!isDatabaseEnabled()) {
    return;
  }

  if (typeof analyticsSessionId !== "string" || analyticsSessionId.length < 6) {
    return;
  }

  const { isMember, membershipRole } = determineMembership(roles ?? undefined);

  try {
    await prisma.analyticsSession.update({
      where: { id: analyticsSessionId },
      data: {
        userId: userId ?? null,
        membershipRole,
        isMember,
      },
    });
  } catch {
    // Ignore missing session errors
  }
}
