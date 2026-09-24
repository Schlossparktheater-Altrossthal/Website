import { randomUUID } from "node:crypto";
import NextAuth, { CredentialsSignin } from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { JWT } from "next-auth/jwt";
import type { AvatarSource, Role } from "@prisma/client";
import Credentials from "next-auth/providers/credentials";
import Authentik from "next-auth/providers/authentik";
import type { CredentialInput } from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sortRoles, ROLES } from "@/lib/roles";
import { DEV_TEST_USER_EMAILS, DEV_TEST_USER_ROLE_MAP } from "@/lib/auth-dev-test-users";
import { verifyPassword } from "@/lib/password";
import { combineNameParts } from "@/lib/names";
import { canSignInAsReturnee, resolveActiveInvite } from "@/lib/onboarding/returnee";
import { ensureDevTestUser } from "@/lib/dev-auth";
import { recordSessionEnd, recordSessionStart } from "@/lib/auth/session";
import { getAuthSecret } from "@/lib/auth-secret";
import {
  AUTHENTIK_PROVIDER_ID,
  getAuthentikLogoutUrl,
  ONBOARDING_TOKEN_COOKIE,
  getAuthentikOidcConfig,
  isLegacyPasswordLoginActive,
} from "@/lib/authentik/config";
import { hasAuthentikAccount, linkAuthentikAccount } from "@/lib/authentik/account-link";
import { migratePasswordToAuthentik } from "@/lib/authentik/migration";

type MutableToken = JWT & {
  id?: string;
  role?: Role;
  roles?: Role[];
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  email?: string;
  avatarSource?: AvatarSource;
  avatarUpdatedAt?: string | null;
  isDeactivated?: boolean;
  deactivatedAt?: string | null;
  sessionVersion?: number;
  analyticsSessionId?: string | null;
  /** Provider der Anmeldung (z. B. "authentik" oder "credentials"). */
  authProvider?: string | null;
};

type RoleSource = { role?: unknown; roles?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const isRole = (value: unknown): value is Role =>
  typeof value === "string" && (ROLES as readonly string[]).includes(value);

const AVATAR_SOURCE_VALUES = ["GRAVATAR", "UPLOAD", "INITIALS"] as const;

const isAvatarSource = (value: unknown): value is AvatarSource =>
  typeof value === "string" && (AVATAR_SOURCE_VALUES as readonly string[]).includes(value);

function extractAvatarSource(value: unknown): AvatarSource | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toUpperCase();
  return isAvatarSource(normalized) ? (normalized as AvatarSource) : undefined;
}

function extractIsoDate(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed.toISOString();
    }
  }
  return undefined;
}

function applyAvatarFields(target: MutableToken, source: Record<string, unknown>) {
  if ("avatarSource" in source) {
    const raw = (source as { avatarSource?: unknown }).avatarSource;
    const parsed = extractAvatarSource(raw);
    if (parsed) {
      target.avatarSource = parsed;
    }
  }

  const updatedRaw =
    "avatarUpdatedAt" in source
      ? (source as { avatarUpdatedAt?: unknown }).avatarUpdatedAt
      : "avatarImageUpdatedAt" in source
        ? (source as { avatarImageUpdatedAt?: unknown }).avatarImageUpdatedAt
        : undefined;

  if (updatedRaw === null) {
    target.avatarUpdatedAt = null;
  } else {
    const parsedDate = extractIsoDate(updatedRaw);
    if (parsedDate !== undefined) {
      target.avatarUpdatedAt = parsedDate;
    }
  }
}

function applyNameFields(target: MutableToken, source: Record<string, unknown>) {
  let fallbackName: string | null | undefined;

  if ("firstName" in source) {
    const raw = (source as { firstName?: unknown }).firstName;
    if (raw === null) {
      target.firstName = null;
    } else {
      const parsed = extractString(raw);
      if (parsed !== undefined) {
        target.firstName = parsed;
      }
    }
  }

  if ("lastName" in source) {
    const raw = (source as { lastName?: unknown }).lastName;
    if (raw === null) {
      target.lastName = null;
    } else {
      const parsed = extractString(raw);
      if (parsed !== undefined) {
        target.lastName = parsed;
      }
    }
  }

  if ("name" in source) {
    const raw = (source as { name?: unknown }).name;
    if (raw === null) {
      fallbackName = null;
    } else {
      const parsed = extractString(raw);
      if (parsed !== undefined) {
        fallbackName = parsed;
      }
    }
  }

  const combined = combineNameParts(target.firstName, target.lastName);
  if (combined) {
    target.name = combined;
  } else if (fallbackName !== undefined) {
    target.name = fallbackName;
  }
}

function extractString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function extractRoles(value: unknown): Role[] | undefined {
  if (Array.isArray(value)) {
    const roles = value
      .map((entry) => {
        if (isRole(entry)) return entry;
        if (isRecord(entry) && isRole(entry.role)) return entry.role;
        return undefined;
      })
      .filter((role): role is Role => Boolean(role));
    return roles.length ? sortRoles(roles) : undefined;
  }

  if (isRecord(value) && isRole(value.role)) {
    return [value.role];
  }

  if (isRole(value)) {
    return [value];
  }

  return undefined;
}

function extractRolesFromSource(source: RoleSource | undefined): Role[] | undefined {
  if (!source) return undefined;
  return extractRoles(source.roles) ?? extractRoles(source.role);
}

// Force secure cookies only in production so local http development works even
// when NEXTAUTH_URL points to an https domain (avoids login redirect loops).
const useSecureCookies = process.env.NODE_ENV === "production";

/** Passwort liegt schon in Authentik; das Login-Formular zeigt dann den SSO-Hinweis. */
class AuthentikMigratedSignin extends CredentialsSignin {
  code = "authentik_migrated";
}

/** ÜBERGANGSPHASE vorbei: alter Passwort-Login ist abgeschaltet. */
class LegacyLoginClosedSignin extends CredentialsSignin {
  code = "legacy_login_closed";
}

const authentikOidcConfig = getAuthentikOidcConfig();

const authentikProviders = authentikOidcConfig
  ? [
      Authentik({
        issuer: authentikOidcConfig.issuer,
        clientId: authentikOidcConfig.clientId,
        clientSecret: authentikOidcConfig.clientSecret,
        // Scope "mitgliederbereich" liefert den Claim member_id (Profil-ID).
        authorization: { params: { scope: "openid profile email mitgliederbereich" } },
        // Keine automatische Verknüpfung über die E-Mail (in Authentik nicht
        // eindeutig): Der signIn-Callback ordnet das Konto selbst zu und legt
        // die Verknüpfung an, bevor Auth.js den Nutzer sucht.
        allowDangerousEmailAccountLinking: false,
        profile(profile) {
          return {
            id: profile.sub,
            email: typeof profile.email === "string" ? profile.email.toLowerCase() : null,
            name: typeof profile.name === "string" ? profile.name : null,
          };
        },
      }),
    ]
  : [];

const credentialInputs: Record<string, CredentialInput> = {
  email: { label: "Email", type: "email" },
  password: { label: "Passwort", type: "password" },
  onboardingToken: { label: "Onboarding-Token", type: "text" },
};

if (process.env.NODE_ENV !== "production") {
  credentialInputs.dev = { label: "Dev", type: "text" };
}

/**
 * Authentik-Login nur für bestehende Mitglieder. Zuordnung in dieser
 * Reihenfolge:
 * 1. gespeicherte Verknüpfung (Account mit sub = Authentik-UID),
 * 2. Claim member_id (Attribut, das nur der Mitgliederbereich setzt),
 * 3. nur für Konten ohne member_id (z. B. Infrastruktur-Admins): E-Mail.
 * Neue Profile entstehen nie über Authentik, sondern weiterhin über
 * Onboarding bzw. Mitgliederverwaltung.
 */
async function authorizeAuthentikSignIn(
  sub: string,
  claims: { email?: unknown; memberId?: unknown },
): Promise<boolean | string> {
  const memberSelect = { id: true, deactivatedAt: true } as const;
  const linked = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: { provider: AUTHENTIK_PROVIDER_ID, providerAccountId: sub },
    },
    select: { user: { select: memberSelect } },
  });

  let member = linked?.user ?? null;
  if (!member) {
    const memberId = typeof claims.memberId === "string" ? claims.memberId.trim() : "";
    const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
    if (memberId) {
      member = await prisma.user.findUnique({ where: { id: memberId }, select: memberSelect });
    } else if (email) {
      member = await prisma.user.findUnique({ where: { email }, select: memberSelect });
    }
  }
  if (!member) return "/login?error=AccessDenied&reason=not-a-member";

  if (member.deactivatedAt) {
    // Rückkehrer aus dem Onboarding: Die Login-Seite legt den Einladungs-Token
    // vor dem Sprung zu Authentik in ein kurzlebiges Cookie. Das Konto bleibt
    // deaktiviert, bis das Rückkehrer-Onboarding abgeschlossen ist.
    const cookieStore = await cookies();
    const invite = await resolveActiveInvite(cookieStore.get(ONBOARDING_TOKEN_COOKIE)?.value);
    if (!canSignInAsReturnee(member, invite)) {
      return "/login?error=AccessDenied&reason=deactivated";
    }
    cookieStore.delete(ONBOARDING_TOKEN_COOKIE);
  }

  if (!linked) {
    await linkAuthentikAccount(member.id, sub);
  }
  return true;
}

const credentialsProvider = Credentials({
  name: "Passwort Login",
  credentials: credentialInputs,
  async authorize(credentials) {
    const rawEmail = typeof credentials?.email === "string" ? credentials.email : undefined;
    const rawPassword =
      typeof credentials?.password === "string" ? credentials.password : undefined;
    const devFlag = typeof credentials?.dev === "string" ? credentials.dev : undefined;
    const email = rawEmail?.toLowerCase();
    const devFastLogin = process.env.NODE_ENV !== "production" && devFlag === "1";

    if (!email) throw new CredentialsSignin();

    if (devFastLogin) {
      if (!DEV_TEST_USER_EMAILS.includes(email)) throw new CredentialsSignin();
      const role = DEV_TEST_USER_ROLE_MAP[email];
      if (!role) throw new CredentialsSignin();

      const profile = await ensureDevTestUser(email, role);
      return {
        id: profile.id,
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        name: profile.name,
        role: profile.role,
        roles: profile.roles,
        avatarSource: profile.avatarSource,
        avatarUpdatedAt: profile.avatarImageUpdatedAt
          ? profile.avatarImageUpdatedAt.toISOString()
          : null,
      };
    }

    if (!rawPassword) {
      throw new CredentialsSignin("Passwort erforderlich");
    }

    // ÜBERGANGSPHASE: Nach dem Stichtag AUTHENTIK_LEGACY_LOGIN_UNTIL ist nur
    // noch die Anmeldung über Authentik möglich.
    if (!isLegacyPasswordLoginActive()) {
      throw new LegacyLoginClosedSignin();
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { roles: true },
    });

    if (user && !user.passwordHash && (await hasAuthentikAccount(user.id))) {
      // Passwort liegt bereits in Authentik (migriert oder dort gesetzt).
      throw new AuthentikMigratedSignin();
    }

    if (!user || !user.passwordHash) {
      throw new CredentialsSignin("Ungültige Zugangsdaten");
    }

    const valid = await verifyPassword(rawPassword, user.passwordHash);
    if (!valid) {
      throw new CredentialsSignin("Ungültige Zugangsdaten");
    }

    // ÜBERGANGSPHASE: Passwort nach Authentik übertragen und lokalen Hash
    // löschen. Scheitert das (z. B. Authentik nicht erreichbar), klappt der
    // Login trotzdem und der nächste Login versucht es erneut. Hat das Mitglied
    // in Authentik schon ein neueres Passwort, gilt nur noch dieses.
    const migration = await migratePasswordToAuthentik(user.id, rawPassword, "legacy-login");
    if (migration.status === "superseded") {
      throw new AuthentikMigratedSignin();
    }

    const onboardingToken =
      typeof credentials?.onboardingToken === "string" ? credentials.onboardingToken : undefined;
    // Ohne gültige Einladung lehnt der signIn-Callback deaktivierte Konten ab.
    const returneeInvite = user.deactivatedAt ? await resolveActiveInvite(onboardingToken) : null;

    const combinedRoles = sortRoles([user.role as Role, ...user.roles.map((r) => r.role as Role)]);

    return {
      id: user.id,
      email: user.email!,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      name: combineNameParts(user.firstName, user.lastName) ?? user.name ?? null,
      role: combinedRoles[combinedRoles.length - 1],
      roles: combinedRoles,
      avatarSource: user.avatarSource,
      avatarUpdatedAt: user.avatarImageUpdatedAt ? user.avatarImageUpdatedAt.toISOString() : null,
      returneeOnboarding: Boolean(returneeInvite),
    };
  },
});

const authConfig = {
  adapter: PrismaAdapter(prisma),
  useSecureCookies,
  // JWT sessions (works with Credentials and OIDC).
  session: {
    strategy: "jwt",
    // Keep logins valid for roughly one month and refresh them regularly when the
    // user returns to the site (sliding expiration).
    maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
    updateAge: 24 * 60 * 60, // refresh token after one day of inactivity
  },
  providers: [...authentikProviders, credentialsProvider],
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === AUTHENTIK_PROVIDER_ID) {
        return authorizeAuthentikSignIn(account.providerAccountId, {
          email: profile?.email ?? user?.email,
          memberId: profile?.member_id,
        });
      }

      const userId = typeof user?.id === "string" ? user.id : null;
      if (!userId) return false;
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { deactivatedAt: true },
      });
      // Deaktivierte Rückkehrer mit gültigem Einladungslink (siehe authorize) dürfen sich
      // anmelden; requireAuth sperrt den Mitgliederbereich bis zum Onboarding-Abschluss.
      if (dbUser?.deactivatedAt && !user?.returneeOnboarding) {
        return "/login?error=AccessDenied&reason=deactivated";
      }
      return true;
    },
    async jwt({ token, user, account, trigger, session }) {
      const mutableToken = token as MutableToken;
      const applyRoles = (roles?: Role[]) => {
        if (!roles || roles.length === 0) return;
        const sorted = sortRoles(roles);
        mutableToken.roles = sorted;
        mutableToken.role = sorted[sorted.length - 1];
      };

      if (user && isRecord(user)) {
        mutableToken.analyticsSessionId = randomUUID();
        mutableToken.authProvider = account?.provider ?? null;
        const id = extractString(user.id);
        if (id) mutableToken.id = id;
        const email = extractString(user.email);
        if (email) mutableToken.email = email;
        mutableToken.deactivatedAt = null;
        mutableToken.isDeactivated = false;
        applyNameFields(mutableToken, user);
        const userRoles = extractRolesFromSource(user);
        if (userRoles) applyRoles(userRoles);
        applyAvatarFields(mutableToken, user);
      }

      if (trigger === "update") {
        const updateSource = isRecord(session)
          ? isRecord(session.user)
            ? session.user
            : session
          : undefined;

        if (isRecord(updateSource)) {
          applyNameFields(mutableToken, updateSource);
          const nextEmail = extractString(updateSource.email);
          if (nextEmail) mutableToken.email = nextEmail;
          const updatedRoles = extractRolesFromSource(updateSource);
          if (updatedRoles) applyRoles(updatedRoles);
          applyAvatarFields(mutableToken, updateSource);
        }
      }

      if (!mutableToken.analyticsSessionId) {
        mutableToken.analyticsSessionId = randomUUID();
      }

      if (mutableToken.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: mutableToken.id },
          select: {
            firstName: true,
            lastName: true,
            name: true,
            email: true,
            role: true,
            roles: { select: { role: true } },
            avatarSource: true,
            avatarImageUpdatedAt: true,
            deactivatedAt: true,
            sessionVersion: true,
          },
        });
        if (dbUser) {
          const combined = sortRoles([
            dbUser.role as Role,
            ...dbUser.roles.map((r) => r.role as Role),
          ]);
          applyRoles(combined);
          const dbUserRecord: Record<string, unknown> = { ...dbUser };
          applyNameFields(mutableToken, dbUserRecord);
          const dbEmail = extractString(dbUser.email);
          if (dbEmail) {
            mutableToken.email = dbEmail;
          }
          applyAvatarFields(mutableToken, dbUserRecord);

          const tokenVersion = mutableToken.sessionVersion;
          const versionMismatch =
            typeof tokenVersion === "number" && dbUser.sessionVersion !== tokenVersion;
          // Beim Deaktivieren steigt die Sitzungsversion: Ältere Logins sind damit
          // beendet (Auth.js löscht das Cookie), statt dauerhaft als deaktiviert zu
          // gelten, auch nachdem das Konto wieder aktiviert wurde (Rückkehrer-
          // Onboarding, "Aktivieren" in der Mitgliederverwaltung).
          if (versionMismatch) {
            return null;
          }
          const isDeactivatedNow = Boolean(dbUser.deactivatedAt);

          if (isDeactivatedNow) {
            mutableToken.isDeactivated = true;
            mutableToken.deactivatedAt = dbUser.deactivatedAt
              ? dbUser.deactivatedAt.toISOString()
              : null;
          } else {
            mutableToken.isDeactivated = false;
            mutableToken.deactivatedAt = null;
            mutableToken.sessionVersion = dbUser.sessionVersion;
          }
        }
      }

      return mutableToken;
    },
    async session({ session, token }) {
      if (session.user) {
        const mutableToken = token as MutableToken;
        if (mutableToken.id) {
          session.user.id = mutableToken.id;
        }
        session.user.firstName = mutableToken.firstName ?? null;
        session.user.lastName = mutableToken.lastName ?? null;
        const sessionFullName =
          combineNameParts(mutableToken.firstName, mutableToken.lastName) ??
          (typeof mutableToken.name === "string" ? mutableToken.name : null);
        session.user.name = sessionFullName;
        if (mutableToken.role) {
          session.user.role = mutableToken.role;
        }
        if (mutableToken.roles) {
          session.user.roles = mutableToken.roles;
        }
        if (mutableToken.email) {
          session.user.email = mutableToken.email;
        }
        session.user.avatarSource = mutableToken.avatarSource ?? null;
        session.user.avatarUpdatedAt = mutableToken.avatarUpdatedAt ?? null;
        session.user.isDeactivated = Boolean(mutableToken.isDeactivated);
        session.user.deactivatedAt = mutableToken.deactivatedAt ?? null;
      }
      session.analyticsSessionId =
        typeof (token as MutableToken).analyticsSessionId === "string"
          ? (token as MutableToken).analyticsSessionId
          : null;
      // Anmeldung über Authentik: Abmelden beendet auch die Authentik-Session.
      session.authentikLogoutUrl =
        (token as MutableToken).authProvider === AUTHENTIK_PROVIDER_ID
          ? getAuthentikLogoutUrl()
          : null;
      return session;
    },
  },
  events: {
    async session({ token }) {
      const mutableToken = token as MutableToken;
      const roles = Array.isArray(mutableToken.roles)
        ? (mutableToken.roles.filter((role): role is Role => typeof role === "string") as Role[])
        : undefined;

      await recordSessionStart({
        analyticsSessionId: mutableToken.analyticsSessionId ?? null,
        userId: typeof mutableToken.id === "string" ? mutableToken.id : null,
        roles,
      });
    },
    async signOut(message) {
      const token = "token" in message ? message.token : null;
      const mutableToken = token as MutableToken | null;
      await recordSessionEnd({
        analyticsSessionId: mutableToken?.analyticsSessionId ?? null,
      });
    },
  },
  get secret() {
    return getAuthSecret();
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
