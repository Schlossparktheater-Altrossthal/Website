import { notFound } from "next/navigation";

import { PageHeader } from "@/components/members/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { readMyUpcomingEvents } from "@/lib/calendar/my-events";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";

import { MyEventsList } from "./my-events-list";

export default async function MyRehearsalsPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "PRIVATE.REHEARSAL.OWN.VIEW");
  if (!allowed) {
    return (
      <div className="text-sm text-destructive">
        Kein Zugriff auf die persönliche Probenübersicht.
      </div>
    );
  }

  const userId = session.user?.id;
  if (!userId) {
    notFound();
  }

  const items = await readMyUpcomingEvents(userId);

  const breadcrumbs = [membersNavigationBreadcrumb("/mitglieder/meine-proben")];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meine Termine"
        description="Deine nächsten Termine – und warum du jeweils dabei bist."
        breadcrumbs={breadcrumbs}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.68fr)_minmax(0,0.32fr)] xl:gap-8">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Anstehende Termine</CardTitle>
            </CardHeader>
            <CardContent>
              <MyEventsList items={items} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sperrliste zuerst nutzen</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                <li>
                  Trage bekannte Abwesenheiten direkt in die Sperrliste ein – dadurch weiß die
                  Planung, dass du fehlst.
                </li>
                <li>
                  Bei kurzfristigen Änderungen informiere zusätzlich telefonisch oder per Chat,
                  damit Ersatz organisiert werden kann.
                </li>
                <li>
                  Neue Termine gelten als zugesagt. Kannst du doch nicht, sag über „Absagen“ mit
                  kurzer Begründung ab – die Planung wird sofort informiert.
                </li>
                <li>
                  Nach dem Eintrag in die Sperrliste kannst du den Termin aus deinem Kalender
                  entfernen.
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
