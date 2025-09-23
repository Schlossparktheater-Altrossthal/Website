import { randomUUID } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";
import { encode } from "next-auth/jwt";

import {
  DEV_TEST_USERS,
  DEV_TEST_USER_ROLE_MAP,
} from "@/lib/auth-dev-test-users";
import { ensureDevTestUser } from "@/lib/dev-auth";
import { ROLES, type Role } from "@/lib/roles";

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const SESSION_COOKIE_NAME = IS_PRODUCTION
  ? "__Secure-next-auth.session-token"
  : "next-auth.session-token";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

const ROLE_SET = new Set<Role>(ROLES);

function normalizeEmail(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const atIndex = trimmed.indexOf("@");
  if (atIndex === -1) return `${trimmed.toLowerCase()}@example.com`;
  return trimmed.toLowerCase();
}

function normalizeRole(value: string | null): Role | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return ROLE_SET.has(normalized as Role) ? (normalized as Role) : null;
}

function emailForRole(role: Role): string | null {
  const preset = DEV_TEST_USERS.find((entry) => entry.role === role);
  return preset?.email ?? null;
}

function sanitizeTarget(value: string | null): string {
  if (!value) return "/mitglieder";
  const trimmed = value.trim();
  if (!trimmed) return "/mitglieder";
  if (trimmed.startsWith("//")) return "/mitglieder";
  if (!trimmed.startsWith("/")) return `/${trimmed}`;
  return trimmed;
}

function shouldReturnJson(url: URL) {
  const mode = url.searchParams.get("mode") ?? url.searchParams.get("format");
  return mode === "json" || mode === "api";
}

async function createSessionCookie({
  email,
  role,
}: {
  email: string;
  role: Role;
}) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET missing");
  }

  const devUser = await ensureDevTestUser(email, role);
  const now = Math.floor(Date.now() / 1000);
  const avatarTimestamp = devUser.avatarImageUpdatedAt
    ? devUser.avatarImageUpdatedAt.toISOString()
    : null;

  const tokenPayload = {
    name: devUser.name ?? undefined,
    email: devUser.email,
    sub: devUser.id,
    role: devUser.role,
    roles: devUser.roles,
    firstName: devUser.firstName,
    lastName: devUser.lastName,
    avatarSource: devUser.avatarSource ?? undefined,
    avatarImageUpdatedAt: avatarTimestamp,
    isDeactivated: false,
    deactivatedAt: null,
    iat: now,
    exp: now + SESSION_MAX_AGE,
    jti: randomUUID(),
  };

  const sessionToken = await encode({
    token: tokenPayload,
    secret,
    maxAge: SESSION_MAX_AGE,
  });

  return {
    sessionToken,
    devUser,
  };
}

function resolveRole({
  roleParam,
  email,
}: {
  roleParam: string | null;
  email: string | null;
}): Role {
  if (roleParam) {
    const normalized = normalizeRole(roleParam);
    if (!normalized) {
      throw new Error(`Unknown role: ${roleParam}`);
    }
    return normalized;
  }

  if (email) {
    const mapped = DEV_TEST_USER_ROLE_MAP[email];
    if (mapped && ROLE_SET.has(mapped)) {
      return mapped;
    }
  }

  return "owner";
}

function ensureEmail(role: Role, emailParam: string | null): string {
  const normalized = normalizeEmail(emailParam);
  if (normalized) {
    return normalized;
  }
  const fallback = emailForRole(role);
  if (fallback) {
    return fallback;
  }
  throw new Error(`No dev test email configured for role "${role}"`);
}

export async function GET(request: NextRequest) {
  if (IS_PRODUCTION) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const url = new URL(request.url);
    const wantsJson = shouldReturnJson(url);
    const role = resolveRole({
      roleParam: url.searchParams.get("role"),
      email: normalizeEmail(url.searchParams.get("email")),
    });
    const email = ensureEmail(role, url.searchParams.get("email"));
    const target = sanitizeTarget(url.searchParams.get("target") ?? url.searchParams.get("to"));
    const { sessionToken, devUser } = await createSessionCookie({ email, role });

    const response = wantsJson
      ? NextResponse.json({
          ok: true,
          email: devUser.email,
          role: devUser.role,
          target,
        })
      : NextResponse.redirect(new URL(target, url.origin));

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      sameSite: "lax",
      secure: IS_PRODUCTION,
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[dev-screenshot-session]", error);
    const message =
      error instanceof Error ? error.message : "Entwicklungs-Session konnte nicht erstellt werden.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export const dynamic = "force-dynamic";
