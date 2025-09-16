import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ROLES, type Role } from "@/lib/roles";

export { ROLES, type Role } from "@/lib/roles";

export function hasRole(user: { role?: Role; roles?: Role[] } | null | undefined, ...roles: Role[]) {
  if (!roles.length) return true;
  if (!user) return false;

  const owned = new Set<Role>();
  if (user.role) owned.add(user.role);
  const additional = (user as any)?.roles;
  if (Array.isArray(additional)) {
    for (const r of additional) owned.add(r as Role);
  }

  if (owned.size === 0) return false;

  return roles.some((role) => owned.has(role));
}

export async function requireAuth(roles?: Role[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (roles && !hasRole(session.user, ...roles)) redirect("/");
  return session;
}
