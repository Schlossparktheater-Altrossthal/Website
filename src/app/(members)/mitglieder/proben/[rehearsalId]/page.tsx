import { redirect } from "next/navigation";

/** Alte Adresse (Benachrichtigungen, Kalender-Abos): führt zur Terminseite. */
export default async function LegacyRehearsalPage({
  params,
}: {
  params: Promise<{ rehearsalId: string }>;
}) {
  const { rehearsalId } = await params;
  redirect(`/mitglieder/termine/${rehearsalId}`);
}
