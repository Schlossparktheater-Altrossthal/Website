import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export type Role = "member" | "cast" | "tech" | "board" | "finance_admin" | "admin";

export function hasRole(user: { role?: Role } | null | undefined, ...roles: Role[]) {
  if (!user?.role) return false;
  return roles.includes(user.role);
}

export async function requireAuth(roles?: Role[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if (roles && !hasRole(session.user, ...roles)) redirect("/");
  return session;
}
