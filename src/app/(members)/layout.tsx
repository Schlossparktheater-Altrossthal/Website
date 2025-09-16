import { requireAuth } from "@/lib/rbac";
import { MembersNav } from "@/components/members-nav";
import React from "react";

export default async function MembersLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAuth();
  const role = (session.user as any)?.role as
    | "member"
    | "cast"
    | "tech"
    | "board"
    | "finance_admin"
    | "admin"
    | undefined;
  
  // Debug output
  console.log("MembersLayout Debug:", { sessionUser: session.user, role });

  return (
    <div className="container mx-auto grid md:grid-cols-[14rem_1fr] gap-6">
      <aside className="md:sticky md:top-28 self-start h-fit">
        <MembersNav role={role} />
      </aside>
      <section className="space-y-6">{children}</section>
    </div>
  );
}
