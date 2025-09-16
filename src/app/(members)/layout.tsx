import { requireAuth } from "@/lib/rbac";
import { MembersNav } from "@/components/members-nav";
import type { Role } from "@/lib/roles";
import React from "react";

export default async function MembersLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAuth();
  const roles = ((session.user as any)?.roles as Role[] | undefined) ??
    ((session.user as any)?.role ? [((session.user as any).role as Role)] : []);

  return (
    <div className="container mx-auto grid md:grid-cols-[14rem_1fr] gap-6">
      <aside className="md:sticky md:top-28 self-start h-fit">
        <MembersNav roles={roles} />
      </aside>
      <section className="space-y-6">{children}</section>
    </div>
  );
}
