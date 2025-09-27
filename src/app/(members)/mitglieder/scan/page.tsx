import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { requireAuth } from "@/lib/rbac";

import ScanPageClient from "./scan-page-client";

export default async function ScanPage() {
  await requireAuth();

  const breadcrumb =
    membersNavigationBreadcrumb("/mitglieder/scan") ??
    ({
      label: "Scanner",
      href: "/mitglieder/scan",
    } as const);

  return <ScanPageClient breadcrumb={breadcrumb} />;
}
