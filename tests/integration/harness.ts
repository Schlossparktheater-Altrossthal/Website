import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import type { Role } from "@prisma/client";
import type { Session } from "next-auth";
import { NextRequest } from "next/server";

import { generateInviteToken, hashInviteToken } from "@/lib/member-invites";
import { prisma } from "@/lib/prisma";

type Mail = { to: string; subject: string; text: string };

/** Gemeinsamer Zustand der Mocks aus setup.ts. */
export const itState = {
  session: null as Session | null,
  cookies: new Map<string, string>(),
  mails: [] as Mail[],
  mailEnabled: true,
};

export function resetItState() {
  itState.session = null;
  itState.cookies.clear();
  itState.mails.length = 0;
  itState.mailEnabled = true;
}

export const LEGACY_SHOW_TITLE = "Die unendliche Geschichte";

export type PreMigrationSnapshot = {
  consents: number;
  teaserMembers: string[];
  consentStatus: Record<string, string>;
  activeUsers: string[];
  roles: Record<string, string[]>;
};

export function readPreMigrationSnapshot(): PreMigrationSnapshot {
  return JSON.parse(
    readFileSync(path.resolve(__dirname, ".pre-migration.json"), "utf8"),
  ) as PreMigrationSnapshot;
}

export async function legacyShow() {
  return prisma.show.findFirstOrThrow({ where: { title: LEGACY_SHOW_TITLE } });
}

export async function teaserShow() {
  return prisma.show.findFirstOrThrow({ where: { title: "???" } });
}

const tag = () => randomUUID().slice(0, 8);

/** Legt ein Testkonto an (eindeutige Adresse unter example.org). */
export async function createTestUser(
  options: { roles?: Role[]; deactivated?: boolean; firstName?: string } = {},
) {
  const roles = options.roles ?? ["member"];
  const id = tag();
  return prisma.user.create({
    data: {
      email: `it-${id}@example.org`,
      firstName: options.firstName ?? "Test",
      lastName: `IT-${id}`,
      name: `${options.firstName ?? "Test"} IT-${id}`,
      role: roles[0],
      roles: { create: roles.map((role) => ({ role })) },
      deactivatedAt: options.deactivated ? new Date() : null,
    },
  });
}

export async function createTestShow(status: "planning" | "active" | "finished" = "planning") {
  const id = tag();
  return prisma.show.create({
    data: { year: 2030, title: `IT-Produktion ${id}`, dates: [], status },
  });
}

/** Meldet ein Konto für die folgenden Aufrufe an (wie nach dem Authentik-Login). */
export async function signIn(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { roles: true },
  });
  const roles = Array.from(new Set([user.role, ...user.roles.map((entry) => entry.role)]));
  const session: Session = {
    expires: new Date(Date.now() + 3600_000).toISOString(),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      roles,
      isDeactivated: Boolean(user.deactivatedAt),
      deactivatedAt: user.deactivatedAt?.toISOString() ?? null,
    },
  };
  itState.session = session;
  return session;
}

export function form(entries: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  }
  return data;
}

export async function effectiveRoles(userId: string): Promise<Role[]> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { roles: true },
  });
  return Array.from(new Set([user.role, ...user.roles.map((entry) => entry.role)])).sort();
}

export function jsonRequest(url: string, method: string, body?: unknown) {
  return new NextRequest(new URL(url, "http://localhost"), {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function multipartRequest(url: string, fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return new NextRequest(new URL(url, "http://localhost"), { method: "POST", body: data });
}

/** Ein Admin-Konto (Rolle „admin“) für Verwaltungsaktionen. */
export async function signInAsAdmin() {
  const admin = await createTestUser({ roles: ["admin"], firstName: "Admin" });
  await signIn(admin.id);
  return admin;
}

/** Öffnet einen Einladungslink wie die Seite /onboarding/[token] (legt die Sitzung an). */
export async function openInvite(token: string) {
  const invite = await prisma.memberInvite.findUniqueOrThrow({
    where: { tokenHash: hashInviteToken(token) },
  });
  const sessionToken = generateInviteToken(32);
  await prisma.memberInviteRedemption.create({ data: { inviteId: invite.id, sessionToken } });
  return sessionToken;
}

export function tokenFromLink(link: string | null | undefined): string {
  const match = /\/onboarding\/([^/]+)\/update/.exec(link ?? "");
  if (!match) throw new Error(`Kein Rückkehr-Link: ${link}`);
  return decodeURIComponent(match[1]);
}

/** Minimaler, gültiger Datensatz des Rückkehrer-Wizards (/api/onboarding/update). */
export function returneeUpdatePayload(overrides: Record<string, unknown> = {}) {
  return {
    educationCategory: "work",
    educationSchoolName: null,
    educationClassName: null,
    educationWorkDescription: "Tischlerei",
    educationUniversityName: null,
    educationOtherDescription: null,
    preferences: [],
    dietaryPreference: "Vegetarisch",
    dietaryPreferenceStrictness: "strict",
    dietary: [
      { allergen: "Erdnüsse", level: "SEVERE", symptoms: null, treatment: null, note: null },
    ],
    notes: null,
    photoConsent: true,
    ...overrides,
  };
}
