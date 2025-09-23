import type { AvatarSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { combineNameParts, splitFullName } from "@/lib/names";
import type { Role } from "@/lib/roles";

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
  };
}
