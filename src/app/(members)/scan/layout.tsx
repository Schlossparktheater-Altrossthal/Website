import type { ReactNode } from "react";

import { MembersContentLayout } from "@/components/members/members-app-shell";

export const metadata = {
  title: "Scanner",
};

export default function ScanLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MembersContentLayout width="xl" padding="compact" spacing="compact" gap="sm" />
      {children}
    </>
  );
}
