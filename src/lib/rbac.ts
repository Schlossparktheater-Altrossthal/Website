import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/roles";

export { ROLES, type Role } from "@/lib/roles";

function collectAssignedRoles(user: { role?: Role; roles?: Role[] } | null | undefined) {
  const owned = new Set<Role>();
  if (!user) return owned;

  if (user.role) owned.add(user.role);
  if (Array.isArray(user.roles)) {
    for (const role of user.roles) {
      owned.add(role);
    }
  }

  return owned;
}

export function hasRole(user: { role?: Role; roles?: Role[] } | null | undefined, ...roles: Role[]) {
  if (!roles.length) return true;

  const owned = collectAssignedRoles(user);

  if (owned.size === 0) return false;

  // Owners and Admins have full access (wildcard)
  if (owned.has("owner") || owned.has("admin")) return true;

  return roles.some((role) => owned.has(role));
}

export function hasAssignedRole(
  user: { role?: Role; roles?: Role[] } | null | undefined,
  ...roles: Role[]
) {
  if (!roles.length) return true;

  const owned = collectAssignedRoles(user);

  if (owned.size === 0) return false;

  return roles.some((role) => owned.has(role));
}

export async function requireAuth(roles?: Role[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (session.user.isDeactivated) redirect("/login?error=AccessDenied&reason=deactivated");
  if (roles && !hasRole(session.user, ...roles)) redirect("/");
  return session;
}
