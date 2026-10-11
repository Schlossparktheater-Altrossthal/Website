import { redirect } from "next/navigation";

import { OfficePage } from "@/components/karten/office/office-page";
import { getTicketActor } from "@/lib/karten/access";
import { BOX_OFFICE_PATH } from "@/lib/karten/constants";
import { withShowParam } from "@/lib/karten/context";

export const dynamic = "force-dynamic";

export default async function BoxOfficePage({
  searchParams,
}: {
  searchParams: Promise<{
    produktion?: string;
    vorstellung?: string;
    fehler?: string;
    abgemeldet?: string;
  }>;
}) {
  const params = await searchParams;
  const actor = await getTicketActor();
  if (!actor) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-12 text-center">
        <h1 className="text-xl font-semibold">Kartenbüro</h1>
        {params.abgemeldet ? (
          <p className="text-sm text-muted-foreground">Du bist abgemeldet.</p>
        ) : params.fehler ? (
          <p className="text-sm text-destructive">
            Der Link ist abgelaufen oder gesperrt. Bitte lass dir einen neuen schicken.
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Öffne den persönlichen Link aus deiner Zugangs-Mail, um Reservierungen zu verwalten.
          Mitglieder melden sich im Mitgliederbereich an.
        </p>
      </div>
    );
  }
  if (!actor.canOffice) redirect(withShowParam(`${BOX_OFFICE_PATH}/einlass`, params.produktion));
  return <OfficePage actor={actor} basePath={BOX_OFFICE_PATH} searchParams={params} />;
}
