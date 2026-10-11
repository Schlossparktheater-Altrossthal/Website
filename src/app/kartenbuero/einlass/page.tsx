import { redirect } from "next/navigation";

import { DoorPage } from "@/components/karten/door/door-page";
import { getTicketActor } from "@/lib/karten/access";
import { BOX_OFFICE_PATH } from "@/lib/karten/constants";

export const dynamic = "force-dynamic";

export default async function BoxOfficeDoorPage({
  searchParams,
}: {
  searchParams: Promise<{ produktion?: string; vorstellung?: string }>;
}) {
  const actor = await getTicketActor();
  if (!actor?.canCheckIn) redirect(BOX_OFFICE_PATH);
  return <DoorPage actor={actor} basePath={BOX_OFFICE_PATH} searchParams={await searchParams} />;
}
