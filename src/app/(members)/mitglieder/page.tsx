import Link from "next/link";
import { PageHeader } from "@/components/members/page-header";
import { requireAuth } from "@/lib/rbac";

export default async function MitgliederPage() {
  await requireAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mitgliederbereich"
        description="Der Mitgliederbereich konzentriert sich jetzt auf die wesentlichen Verwaltungsaufgaben."
      />

      <div className="space-y-3 text-sm text-foreground/80">
        <p>
          Bitte nutze die Probenplanung, um neue Proben zu erstellen und Rückmeldungen einzusehen.
          Administratoren finden die Rollenverwaltung weiterhin wie gewohnt vor.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <Link className="text-primary hover:underline" href="/mitglieder/probenplanung">
              Probenplanung
            </Link>{" "}
            für Regie- und Technikteams
          </li>
          <li>
            <Link className="text-primary hover:underline" href="/mitglieder/rollenverwaltung">
              Rollenverwaltung
            </Link>{" "}
            für Administratorinnen und Administratoren
          </li>
        </ul>
      </div>
    </div>
  );
}
