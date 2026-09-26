import { redirect } from "next/navigation";

type PageProps = { searchParams: Promise<{ rolle?: string }> };

/** Alte Adresse: jetzt Ansicht „Rollen“ im Stück. */
export default async function ProduktionsBesetzungPage({ searchParams }: PageProps) {
  const { rolle } = await searchParams;
  redirect(
    `/mitglieder/produktionen/stueck?ansicht=rollen${rolle ? `&rolle=${encodeURIComponent(rolle)}` : ""}`,
  );
}
