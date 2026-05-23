import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { SeitensteuerungManager } from "./seitensteuerung-manager";

export default async function SeitensteuerungPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "PRIVATE.ADMIN.PAGES.MANAGE");
  if (!allowed) redirect("/mitglieder");
  return <SeitensteuerungManager />;
}
