import { NextRequest, NextResponse } from "next/server";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { calculateInviteStatus, describeInvite } from "@/lib/member-invites";
import { sortRoles, ROLES, type Role } from "@/lib/roles";

const DATE_LIMIT_YEARS = 5;

type SessionPromise = ReturnType<typeof requireAuth>;
type SessionUser = Awaited<SessionPromise>["user"];

async function canManageInvites(user: SessionUser) {
  if (!user) return false;
  if (await hasPermission(user, "mitglieder.einladungen")) return true;
  return hasPermission(user, "mitglieder.rollenverwaltung");
}

function normalizeString(value: unknown, maxLength = 200) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function parseBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return undefined;
}

function parseMaxUses(value: unknown) {
  if (value === null) return null;
  if (value === undefined || value === "") return undefined;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  return Math.max(Math.floor(numeric), 1);
}

function parseDate(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.valueOf())) return undefined;
  const now = new Date();
  const limit = new Date(now);
  limit.setFullYear(limit.getFullYear() + DATE_LIMIT_YEARS);
  if (parsed > limit) return limit;
  return parsed;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if (!(await canManageInvites(session.user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Ungültige Einladung" }, { status: 400 });
  }

  const body = await request.json().catch(() => null) as
    | {
        isDisabled?: unknown;
        expiresAt?: unknown;
        maxUses?: unknown;
        label?: unknown;
        note?: unknown;
        roles?: unknown;
        showId?: unknown;
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  const disabled = parseBoolean(body.isDisabled);
  if (disabled !== undefined) data.isDisabled = disabled;

  const expiresAt = parseDate(body.expiresAt);
  if (expiresAt !== undefined) data.expiresAt = expiresAt;

  const maxUses = parseMaxUses(body.maxUses);
  if (maxUses !== undefined) data.maxUses = maxUses;

  const label = normalizeString(body.label, 120);
  if (label !== undefined) data.label = label;

  const note = normalizeString(body.note, 400);
  if (note !== undefined) data.note = note;

  const roles = parseRoles(body.roles);
  if (roles !== undefined) data.roles = roles;

  if (body.showId !== undefined) {
    const rawShowId = typeof body.showId === "string" ? body.showId.trim() : "";
    if (!rawShowId) {
      return NextResponse.json({ error: "Bitte wähle eine Produktion aus." }, { status: 400 });
    }

    const show = await prisma.show.findUnique({
      where: { id: rawShowId },
      select: { id: true },
    });

    if (!show) {
      return NextResponse.json({ error: "Produktion wurde nicht gefunden" }, { status: 404 });
    }

    data.showId = show.id;
  }

  try {
    const invite = await prisma.memberInvite.update({
      where: { id },
      data,
      include: {
        redemptions: { select: { id: true, completedAt: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        show: { select: { id: true, title: true, year: true } },
      },
    });

    if (typeof maxUses === "number" && invite.usageCount > maxUses) {
      const adjusted = await prisma.memberInvite.update({
        where: { id },
        data: { maxUses: invite.usageCount },
      });
      invite.maxUses = adjusted.maxUses;
    }

    const status = describeInvite(invite);
    const now = new Date();
    const statusInfo = calculateInviteStatus(invite, now);
    const completed = invite.redemptions.filter((r) => r.completedAt).length;
    const pending = invite.redemptions.length - completed;

    return NextResponse.json({
      ok: true,
      invite: {
        ...status,
        createdAt: invite.createdAt.toISOString(),
        expiresAt: invite.expiresAt ? invite.expiresAt.toISOString() : null,
        remainingUses: statusInfo.remainingUses,
        isExpired: statusInfo.isExpired,
        isExhausted: statusInfo.isExhausted,
        pendingSessions: pending,
        completedSessions: completed,
        createdBy: invite.createdBy,
        show: invite.show,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Einladung nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json({ error: "Aktualisierung fehlgeschlagen" }, { status: 500 });
  }
}

function parseRoles(value: unknown): Role[] | undefined {
  if (value === undefined) return undefined;
  if (value === null) {
    return ["member"];
  }
  if (!Array.isArray(value)) return undefined;
  const allowed = value.filter((entry): entry is Role =>
    typeof entry === "string" && (ROLES as readonly string[]).includes(entry),
  );
  const normalized = sortRoles(allowed.length ? allowed : ["member"]);
  return normalized.length ? normalized : ["member"];
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  if (!(await canManageInvites(session.user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Ungültige Einladung" }, { status: 400 });
  }

  try {
    await prisma.memberInvite.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Einladung nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json({ error: "Löschen fehlgeschlagen" }, { status: 500 });
  }
}
