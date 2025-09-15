"use client";
import type { Role } from "@/lib/rbac";

export function VisibleForRole({
  role,
  userRole,
  children,
}: { role: Role | Role[]; userRole?: Role; children: React.ReactNode }) {
  const roles = Array.isArray(role) ? role : [role];
  if (!userRole || !roles.includes(userRole)) return null;
  return <>{children}</>;
}

