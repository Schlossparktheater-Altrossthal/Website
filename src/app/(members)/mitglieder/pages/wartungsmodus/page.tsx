import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { WartungsmodusManager } from "./wartungsmodus-manager";

export default async function WartungsmodusPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "pages.manage");
  if (!allowed) redirect("/mitglieder");
  return <WartungsmodusManager />;
}
