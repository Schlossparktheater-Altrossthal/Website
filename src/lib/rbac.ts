import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/roles";
import { applyImpersonation } from "@/lib/auth/impersonation";

export { ROLES, type Role } from "@/lib/roles";

export function hasRole(user: { role?: Role; roles?: Role[] } | null | undefined, ...roles: Role[]) {
  if (!roles.length) return true;
  if (!user) return false;

  const owned = new Set<Role>();
  if (user.role) owned.add(user.role);
  if (Array.isArray(user.roles)) {
    for (const role of user.roles) {
      owned.add(role);
    }
  }

  if (owned.size === 0) return false;

  // Owners and Admins have full access (wildcard)
  if (owned.has("owner") || owned.has("admin")) return true;

  return roles.some((role) => owned.has(role));
}

type SessionOptions = {
  allowImpersonation?: boolean;
};

export async function getSession(options?: SessionOptions) {
  const session = await getServerSession(authOptions);
  const allowImpersonation = options?.allowImpersonation !== false;
  return applyImpersonation(session, allowImpersonation);
}

export async function requireAuth(roles?: Role[], options?: SessionOptions) {
  const session = await getSession(options);
  if (!session?.user) redirect("/login");
  if (session.user.isDeactivated) redirect("/login?error=AccessDenied&reason=deactivated");
  if (roles && !hasRole(session.user, ...roles)) redirect("/");
  return session;
}
