import type { AvatarSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { combineNameParts, splitFullName } from "@/lib/names";
import {
  DEFAULT_PRIMARY_ROLE,
  isPrimaryRole,
  sortRoles,
  type Role,
} from "@/lib/roles";

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
};

export async function ensureDevTestUser(email: string, role: Role): Promise<DevTestUserProfile> {
  const normalizedEmail = email.trim().toLowerCase();
  const friendlyName = normalizedEmail.split("@")[0] ?? "";
  const trimmedName = friendlyName.trim();
  const { firstName: derivedFirstName, lastName: derivedLastName } = splitFullName(trimmedName);
  const combinedName = combineNameParts(derivedFirstName, derivedLastName) ?? (trimmedName || null);

  const primaryRole = isPrimaryRole(role) ? role : DEFAULT_PRIMARY_ROLE;
  const supplementalRoles = isPrimaryRole(role) ? [] : [role];
  const allRoles = sortRoles([primaryRole, ...supplementalRoles]);

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      firstName: derivedFirstName,
      lastName: derivedLastName,
      name: combinedName,
      role: primaryRole,
    },
    create: {
      email: normalizedEmail,
      firstName: derivedFirstName,
      lastName: derivedLastName,
      name: combinedName,
      role: primaryRole,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      roles: {
        deleteMany: {},
        create: allRoles.map((entry) => ({ role: entry })),
      },
    },
  });

  return {
    id: user.id,
    email: user.email!,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    name: combineNameParts(user.firstName, user.lastName) ?? (user.name ?? null),
    role: primaryRole,
    roles: allRoles,
    avatarSource: user.avatarSource,
    avatarImageUpdatedAt: user.avatarImageUpdatedAt,
  };
}
