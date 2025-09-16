"use client";
import type { Role } from "@/lib/roles";

export function VisibleForRole({
  role,
  userRoles,
  children,
}: { role: Role | Role[]; userRoles?: Role[]; children: React.ReactNode }) {
  const required = Array.isArray(role) ? role : [role];
  const owned = new Set(userRoles ?? []);
  if (owned.size === 0) return null;
  return required.some((r) => owned.has(r)) ? <>{children}</> : null;
}
