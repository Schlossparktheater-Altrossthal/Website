import { createHash } from "node:crypto";

import type { AvatarSource } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { combineNameParts, splitFullName } from "@/lib/names";
import type { Role } from "@/lib/roles";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

function isDatabaseConfigured(): boolean {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    return false;
  }

  try {
    // Validate the connection string for obvious mistakes without opening a
    // connection. Invalid URLs should still trigger the offline fallback.
    new URL(connectionString);
    return true;
  } catch (error) {
    console.warn("[dev-auth] Invalid DATABASE_URL configured", error);
    return false;
  }
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function createOfflineProfile({
  normalizedEmail,
  role,
  firstName,
  lastName,
  fallbackNameSource,
}: {
  normalizedEmail: string;
  role: Role;
  firstName: string | null;
  lastName: string | null;
  fallbackNameSource: string;
}): DevTestUserProfile {
  const hash = createHash("sha256").update(normalizedEmail).digest("hex");
  const offlineId = hash.slice(0, 24);

  const roleLabel = toTitleCase(role);
  const sanitizedSegments = fallbackNameSource
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((segment) => toTitleCase(segment));

  const hasDerivedFullName = Boolean(firstName && lastName);

  const resolvedFirstName = hasDerivedFullName
    ? toTitleCase(firstName!)
    : sanitizedSegments.length >= 2
    ? sanitizedSegments[0]!
    : "Offline";
  const resolvedLastName = hasDerivedFullName
    ? toTitleCase(lastName!)
    : sanitizedSegments.length >= 2
    ? sanitizedSegments.slice(1).join(" ")
    : sanitizedSegments[0] ?? roleLabel;

  const offlineName =
    combineNameParts(resolvedFirstName, resolvedLastName) ??
    `${resolvedFirstName} ${resolvedLastName}`.trim();

  return {
    id: offlineId,
    email: normalizedEmail,
    firstName: resolvedFirstName,
    lastName: resolvedLastName,
    name: offlineName,
    role,
    roles: [role],
    avatarSource: null,
    avatarImageUpdatedAt: null,
    isOfflineProfile: true,
  };
}

export type DevTestUserProfile = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  role: Role;
  roles: Role[];
  avatarSource: AvatarSource | null;
  avatarImageUpdatedAt: Date | null;
  isOfflineProfile: boolean;
};

export async function ensureDevTestUser(email: string, role: Role): Promise<DevTestUserProfile> {
  const normalizedEmail = email.trim().toLowerCase();
  const friendlyName = normalizedEmail.split("@")[0] ?? "";
  const trimmedName = friendlyName.trim();
  const { firstName: derivedFirstName, lastName: derivedLastName } = splitFullName(trimmedName);
  const combinedName = combineNameParts(derivedFirstName, derivedLastName) ?? (trimmedName || null);

  if (!IS_PRODUCTION && !isDatabaseConfigured()) {
    console.warn("[dev-auth] No DATABASE_URL configured, using offline dev profile");
    return createOfflineProfile({
      normalizedEmail,
      role,
      firstName: derivedFirstName,
      lastName: derivedLastName,
      fallbackNameSource: trimmedName || role,
    });
  }

  try {
    const user = await prisma.user.upsert({
      where: { email: normalizedEmail },
      update: {
        firstName: derivedFirstName,
        lastName: derivedLastName,
        name: combinedName,
        role,
      },
      create: {
        email: normalizedEmail,
        firstName: derivedFirstName,
        lastName: derivedLastName,
        name: combinedName,
        role,
      },
    });

    await prisma.userRole.upsert({
      where: { userId_role: { userId: user.id, role } },
      update: {},
      create: { userId: user.id, role },
    });

    return {
      id: user.id,
      email: user.email!,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      name: combineNameParts(user.firstName, user.lastName) ?? (user.name ?? null),
      role,
      roles: [role],
      avatarSource: user.avatarSource,
      avatarImageUpdatedAt: user.avatarImageUpdatedAt,
      isOfflineProfile: false,
    };
  } catch (error) {
    if (IS_PRODUCTION) {
      throw error;
    }

    console.warn("[dev-auth] Falling back to offline dev profile", error);
    return createOfflineProfile({
      normalizedEmail,
      role,
      firstName: derivedFirstName,
      lastName: derivedLastName,
      fallbackNameSource: trimmedName || role,
    });
  }
}
