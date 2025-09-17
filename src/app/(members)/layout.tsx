import React from "react";
import { MembersNav } from "@/components/members-nav";
import { requireAuth } from "@/lib/rbac";

export default async function MembersLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAuth();
  const roles = session.user?.roles ?? (session.user?.role ? [session.user.role] : []);

  return (
    <main className="w-full pb-12 pt-6 sm:pt-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 sm:px-6 lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start lg:gap-10 lg:px-8">
        <aside className="lg:sticky lg:top-28 lg:h-fit lg:self-start">
          <MembersNav roles={roles} />
        </aside>
        <section className="min-w-0 space-y-8">{children}</section>
      </div>
    </main>
  );
}
