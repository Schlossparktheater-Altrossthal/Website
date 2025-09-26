import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { describeInvite, generateInviteToken, hashInviteToken, calculateInviteStatus } from "@/lib/member-invites";
import { getOnboardingWhatsAppLink } from "@/lib/onboarding-settings";
import { onboardingPathForHash, onboardingPathForToken } from "@/lib/member-invite-links";
import { sortRoles, ROLES, type Role } from "@/lib/roles";

const DATE_LIMIT_YEARS = 5;

type SessionPromise = ReturnType<typeof requireAuth>;
type SessionUser = Awaited<SessionPromise>["user"];

async function canManageInvites(user: SessionUser) {
  if (!user) return false;
  if (await hasPermission(user, "mitglieder.einladungen")) return true;
  return hasPermission(user, "mitglieder.rollenverwaltung");
}

function parseDate(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.valueOf())) return null;
  const now = new Date();
  const max = new Date(now);
  max.setFullYear(max.getFullYear() + DATE_LIMIT_YEARS);
  if (parsed > max) return max;
  return parsed;
}

function parseMaxUses(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.max(Math.floor(numeric), 1);
  return rounded;
}

function normalizeString(value: unknown, maxLength = 200) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function filterRoles(value: unknown): Role[] {
  if (!Array.isArray(value)) return ["member"];
  const set = new Set<Role>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    if ((ROLES as readonly string[]).includes(entry)) {
      set.add(entry as Role);
    }
  }
  const result = sortRoles(set.size ? Array.from(set) : ["member"]);
  return result.length ? result : ["member"];
}

export async function GET() {
  const session = await requireAuth();
  if (!(await canManageInvites(session.user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [invites, productions] = await Promise.all([
    prisma.memberInvite.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        redemptions: {
          select: { id: true, createdAt: true, completedAt: true },
          orderBy: { createdAt: "desc" },
        },
        show: { select: { id: true, title: true, year: true, meta: true } },
      },
    }),
    prisma.show.findMany({
      orderBy: { year: "desc" },
      select: { id: true, title: true, year: true, meta: true },
    }),
  ]);

  const now = new Date();
  const formatted = invites.map((invite) => {
    const status = calculateInviteStatus(invite, now);
    const completed = invite.redemptions.filter((r) => r.completedAt).length;
    const pending = invite.redemptions.length - completed;
    const recentClicks = invite.redemptions.slice(0, 3).map((entry) => entry.createdAt.toISOString());
    const production = invite.show
      ? {
          id: invite.show.id,
          title: invite.show.title,
          year: invite.show.year,
          whatsappLink: getOnboardingWhatsAppLink(invite.show.meta),
        }
      : null;

    return {
      id: invite.id,
      label: invite.label,
      note: invite.note,
      createdAt: invite.createdAt.toISOString(),
      expiresAt: invite.expiresAt ? invite.expiresAt.toISOString() : null,
      maxUses: invite.maxUses,
      usageCount: invite.usageCount,
      roles: invite.roles,
      isDisabled: invite.isDisabled,
      createdBy: invite.createdBy,
      show: production,
      remainingUses: status.remainingUses,
      isActive: status.isActive,
      isExpired: status.isExpired,
      isExhausted: status.isExhausted,
      pendingSessions: pending,
      completedSessions: completed,
      shareUrl: status.isActive
        ? onboardingPathForHash(invite.tokenHash, invite.roles)
        : null,
      recentClicks,
    };
  });

  const formattedProductions = productions.map((show) => ({
    id: show.id,
    title: show.title,
    year: show.year,
    whatsappLink: getOnboardingWhatsAppLink(show.meta),
  }));

  return NextResponse.json({ invites: formatted, productions: formattedProductions });
}

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (!(await canManageInvites(session.user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as
    | {
        label?: unknown;
        note?: unknown;
        expiresAt?: unknown;
        maxUses?: unknown;
        roles?: unknown;
        showId?: unknown;
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const label = normalizeString(body.label, 120);
  const note = normalizeString(body.note, 400);
  const expiresAt = parseDate(body.expiresAt);
  const maxUses = parseMaxUses(body.maxUses);
  const roles = filterRoles(body.roles);
  const rawShowId = typeof body.showId === "string" ? body.showId.trim() : "";
  if (!rawShowId) {
    return NextResponse.json({ error: "Bitte wähle eine Produktion aus." }, { status: 400 });
  }

  const show = await prisma.show.findUnique({
    where: { id: rawShowId },
    select: { id: true, title: true, year: true },
  });

  if (!show) {
    return NextResponse.json({ error: "Produktion wurde nicht gefunden" }, { status: 404 });
  }

  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);

  const createdById = session.user?.id;
  if (!createdById) {
    return NextResponse.json({ error: "Benutzerkontext fehlt" }, { status: 500 });
  }

  const invite = await prisma.memberInvite.create({
    data: {
      tokenHash,
      label,
      note,
      expiresAt,
      maxUses,
      roles,
      createdById,
      showId: show.id,
    },
    include: { show: { select: { id: true, title: true, year: true } } },
  });

  const status = describeInvite(invite);

  return NextResponse.json({
    ok: true,
    invite: {
      ...status,
      createdAt: invite.createdAt.toISOString(),
      expiresAt: invite.expiresAt ? invite.expiresAt.toISOString() : null,
      token,
      inviteUrl: onboardingPathForToken(token, invite.roles),
      shareUrl: onboardingPathForHash(invite.tokenHash, invite.roles),
      show: invite.show,
    },
  });
}
