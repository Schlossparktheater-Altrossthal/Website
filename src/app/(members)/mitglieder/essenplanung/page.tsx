import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LegacyEssensplanungRedirect() {
  redirect("/mitglieder/endproben-woche/essenplanung");
}
