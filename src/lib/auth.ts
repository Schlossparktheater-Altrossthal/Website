import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import type { NextAuthOptions } from "next-auth";
import type { AvatarSource, Role } from "@prisma/client";
import type { AdapterUser } from "next-auth/adapters";
import type { JWT } from "next-auth/jwt";
import EmailProvider from "next-auth/providers/email";
import Credentials from "next-auth/providers/credentials";
import type { CredentialInput } from "next-auth/providers/credentials";
import { sortRoles, ROLES } from "@/lib/roles";
import { verifyPassword } from "@/lib/password";
import { combineNameParts, splitFullName } from "@/lib/names";

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

  const updatedRaw = "avatarUpdatedAt" in source
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

const credentialInputs: Record<string, CredentialInput> = {
  email: { label: "Email", type: "email" },
  password: { label: "Passwort", type: "password" },
};

if (process.env.NODE_ENV !== "production") {
  credentialInputs.dev = { label: "Dev", type: "text" };
}

const credentialsProvider = Credentials({
  name: "Passwort Login",
  credentials: credentialInputs,
  async authorize(credentials) {
    const email = credentials?.email?.toString().toLowerCase();
    const password = credentials?.password?.toString();
    const devFastLogin =
      process.env.NODE_ENV !== "production" && credentials?.dev === "1";

    if (!email) return null;

    if (devFastLogin) {
      const allowed = [
        "member@example.com",
        "cast@example.com",
        "tech@example.com",
        "board@example.com",
        "finance@example.com",
        "owner@example.com",
        "admin@example.com",
      ];
      if (!allowed.includes(email)) return null;
      const roleMap: Record<string, Role> = {
        "member@example.com": "member",
        "cast@example.com": "cast",
        "tech@example.com": "tech",
        "board@example.com": "board",
        "finance@example.com": "finance",
        "owner@example.com": "owner",
        "admin@example.com": "admin",
      };
      const friendlyName = email.split("@")[0] ?? "";
      const trimmedName = friendlyName.trim();
      const { firstName: derivedFirstName, lastName: derivedLastName } = splitFullName(trimmedName);
      const combinedName = combineNameParts(derivedFirstName, derivedLastName) ?? (trimmedName || null);

      const user = await prisma.user.upsert({
        where: { email },
        update: {
          firstName: derivedFirstName,
          lastName: derivedLastName,
          name: combinedName,
        },
        create: {
          email,
          firstName: derivedFirstName,
          lastName: derivedLastName,
          name: combinedName,
          role: roleMap[email],
        },
      });
      await prisma.userRole.upsert({
        where: { userId_role: { userId: user.id, role: roleMap[email] } },
        update: {},
        create: { userId: user.id, role: roleMap[email] },
      });
      return {
        id: user.id,
        email: user.email!,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        name: combineNameParts(user.firstName, user.lastName) ?? (user.name ?? null),
        role: user.role,
        roles: [user.role],
        avatarSource: user.avatarSource,
        avatarImageUpdatedAt: user.avatarImageUpdatedAt,
      };
    }

    if (!password) {
      throw new Error("Passwort erforderlich");
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { roles: true },
    });

    if (!user || !user.passwordHash) {
      throw new Error("Ungültige Zugangsdaten");
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new Error("Ungültige Zugangsdaten");
    }

    const combinedRoles = sortRoles([
      user.role as Role,
      ...user.roles.map((r) => r.role as Role),
    ]);

    return {
      id: user.id,
      email: user.email!,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      name: combineNameParts(user.firstName, user.lastName) ?? (user.name ?? null),
      role: combinedRoles[combinedRoles.length - 1],
      roles: combinedRoles,
      avatarSource: user.avatarSource,
      avatarImageUpdatedAt: user.avatarImageUpdatedAt,
    };
  },
});

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  useSecureCookies,
  // Use JWT sessions for reliability in dev (works with Credentials + Email).
  session: { strategy: "jwt" },
  providers: [
    EmailProvider({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
      async sendVerificationRequest({ identifier, url }) {
        if (!process.env.EMAIL_SERVER || process.env.NODE_ENV !== "production") {
          console.log("[DEV Magic Link]", identifier, url);
        }
      },
    }),
    credentialsProvider,
  ],
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      const mutableToken = token as MutableToken;
      const applyRoles = (roles?: Role[]) => {
        if (!roles || roles.length === 0) return;
        const sorted = sortRoles(roles);
        mutableToken.roles = sorted;
        mutableToken.role = sorted[sorted.length - 1];
      };

      if (user && isRecord(user)) {
        const id = extractString(user.id);
        if (id) mutableToken.id = id;
        const email = extractString(user.email);
        if (email) mutableToken.email = email;
        applyNameFields(mutableToken, user);
        const userRoles = extractRolesFromSource(user as AdapterUser & RoleSource);
        if (userRoles) applyRoles(userRoles);
        applyAvatarFields(mutableToken, user);
      }

      if (trigger === "update") {
        const updateSource = isRecord(session)
          ? (isRecord(session.user) ? session.user : session)
          : undefined;

        if (isRecord(updateSource)) {
          applyNameFields(mutableToken, updateSource);
          const nextEmail = extractString(updateSource.email);
          if (nextEmail) mutableToken.email = nextEmail;
          const updatedRoles = extractRolesFromSource(updateSource as RoleSource);
          if (updatedRoles) applyRoles(updatedRoles);
          applyAvatarFields(mutableToken, updateSource);
        }
      }

      if (mutableToken.id && !mutableToken.roles) {
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
          },
        });
        if (dbUser) {
          const combined = sortRoles([
            dbUser.role as Role,
            ...dbUser.roles.map((r) => r.role as Role),
          ]);
          applyRoles(combined);
          applyNameFields(mutableToken, dbUser as unknown as Record<string, unknown>);
          const dbEmail = extractString(dbUser.email);
          if (dbEmail) {
            mutableToken.email = dbEmail;
          }
          applyAvatarFields(mutableToken, dbUser as unknown as Record<string, unknown>);
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
        const sessionFullName = combineNameParts(mutableToken.firstName, mutableToken.lastName) ?? (typeof mutableToken.name === "string" ? mutableToken.name : null);
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
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
};
