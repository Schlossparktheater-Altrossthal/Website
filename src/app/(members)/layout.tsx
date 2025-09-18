import React from "react";
import { MembersNav } from "@/components/members-nav";
import { requireAuth } from "@/lib/rbac";
import { getUserPermissionKeys } from "@/lib/permissions";

export default async function MembersLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAuth();
  const permissions = await getUserPermissionKeys(session.user);

  return (
    <main className="w-full pb-12 pt-6 sm:pt-8">
      <div
        className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 px-4 sm:px-6 lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start lg:gap-10 lg:px-8 xl:grid-cols-[300px_minmax(0,1fr)] xl:gap-12 xl:px-10 2xl:grid-cols-[320px_minmax(0,1fr)] 2xl:gap-16 2xl:px-12"
      >
        <aside className="lg:sticky lg:top-28 lg:h-fit lg:self-start">
          <MembersNav permissions={permissions} />
        </aside>
        <section className="min-w-0 space-y-8">{children}</section>
      </div>
    </main>
  );
}
