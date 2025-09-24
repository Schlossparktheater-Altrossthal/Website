import type { ReactNode } from "react";

import { MembersContentLayout } from "@/components/members/members-app-shell";

export const metadata = {
  title: "Inventaraufkleber",
};

export default function InventoryStickersLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MembersContentLayout width="full" padding="compact" spacing="comfortable" />
      {children}
    </>
  );
}
