import { redirect } from "next/navigation";

type PageProps = { searchParams: Promise<{ szene?: string }> };

/** Alte Adresse: jetzt Ansicht „Ablauf“ im Stück. */
export default async function ProduktionsSzenenPage({ searchParams }: PageProps) {
  const { szene } = await searchParams;
  redirect(`/mitglieder/produktionen/stueck${szene ? `?szene=${encodeURIComponent(szene)}` : ""}`);
}
