import { redirect } from "next/navigation";

/** Alte Editor-Adresse (Links in Mails und Benachrichtigungen). */
export default async function RehearsalEditorRedirect({
  params,
}: {
  params: Promise<{ rehearsalId: string }>;
}) {
  const { rehearsalId } = await params;
  redirect(`/mitglieder/terminplanung/${encodeURIComponent(rehearsalId)}`);
}
