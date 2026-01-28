import type { ReactNode } from "react";

import { MembersContentLayout } from "@/components/members/members-app-shell";

export default function MeasurementsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MembersContentLayout width="full" />
      {children}
    </>
  );
}
