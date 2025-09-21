import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { collectOnboardingAnalytics } from "@/lib/onboarding-analytics";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

const numberFormat = new Intl.NumberFormat("de-DE");
const percentFormat = new Intl.NumberFormat("de-DE", { style: "percent", minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default async function OnboardingAnalyticsPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.onboarding.analytics");
  if (!allowed) {
    return <div className="text-sm text-red-600">Kein Zugriff auf die Onboarding-Analytics</div>;
  }

  const analytics = await collectOnboardingAnalytics();
  const totalFocus = analytics.completions.total || 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Onboarding Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Überblick über Einladungen, Interessen und offene Aufgaben aus dem Onboarding-Wizard.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aktive Einladungen</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{analytics.invites.active}</p>
            <p className="text-xs text-muted-foreground">von {analytics.invites.total} insgesamt</p>
          </CardContent>
        </Card>
        <Card className="border border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Genutzte Slots</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{analytics.invites.totalUsage}</p>
            <p className="text-xs text-muted-foreground">registrierte Abschlüsse über den Wizard</p>
          </CardContent>
        </Card>
        <Card className="border border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Offene Foto-Dokumente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{analytics.minorsPendingDocuments}</p>
            <p className="text-xs text-muted-foreground">Minderjährige ohne hochgeladenes Elternformular</p>
          </CardContent>
        </Card>
        <Card className="border border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Prüfung ausstehend</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{analytics.pendingPhotoConsents}</p>
            <p className="text-xs text-muted-foreground">Fotoeinverständnisse im Status „Pending“</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Fokusverteilung</CardTitle>
            <p className="text-sm text-muted-foreground">Auswahl aus dem Wizard – Schauspiel, Gewerke oder beides.</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 text-sm">
              {Object.entries(analytics.completions.byFocus).map(([focus, count]) => (
                <div key={focus} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
                  <span className="font-medium capitalize">
                    {focus === "acting" ? "Schauspiel" : focus === "tech" ? "Gewerke" : "Hybrid"}
                  </span>
                  <span>
                    {numberFormat.format(count)} · {percentFormat.format(count / totalFocus)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Beliebte Interessen</CardTitle>
            <p className="text-sm text-muted-foreground">Tags und Themen, die im Wizard angegeben wurden.</p>
          </CardHeader>
          <CardContent>
            {analytics.interests.length ? (
              <ul className="space-y-2 text-sm">
                {analytics.interests.slice(0, 10).map((interest) => (
                  <li key={interest.name} className="flex items-center justify-between">
                    <span>{interest.name}</span>
                    <Badge variant="outline">{interest.count}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Noch keine Interessen erfasst.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border/70">
        <CardHeader>
          <CardTitle>Rollen- & Gewerke-Präferenzen</CardTitle>
          <p className="text-sm text-muted-foreground">Durchschnittliche Gewichtung (0–100) der gewählten Optionen.</p>
        </CardHeader>
        <CardContent>
          {analytics.rolePreferences.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr className="border-b border-border/70">
                    <th className="px-3 py-2">Bereich</th>
                    <th className="px-3 py-2">Option</th>
                    <th className="px-3 py-2">Ø Gewicht</th>
                    <th className="px-3 py-2">Rückmeldungen</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.rolePreferences.slice(0, 12).map((entry) => (
                    <tr key={`${entry.domain}-${entry.code}`} className="border-b border-border/50">
                      <td className="px-3 py-2 text-muted-foreground">
                        {entry.domain === "acting" ? "Schauspiel" : "Gewerke"}
                      </td>
                      <td className="px-3 py-2 font-medium">{humanizePreference(entry.code)}</td>
                      <td className="px-3 py-2">{entry.averageWeight}</td>
                      <td className="px-3 py-2">{entry.responses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Noch keine Präferenzdaten vorhanden.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border border-border/70">
        <CardHeader>
          <CardTitle>Essensunverträglichkeiten</CardTitle>
          <p className="text-sm text-muted-foreground">Aktive Angaben aus dem Wizard für Catering und Veranstaltungen.</p>
        </CardHeader>
        <CardContent>
          {analytics.dietary.length ? (
            <div className="flex flex-wrap gap-3">
              {analytics.dietary.map((entry) => (
                <div key={entry.level} className="rounded-lg border border-border/60 px-3 py-2 text-sm">
                  <p className="font-medium">{dietaryLabel(entry.level)}</p>
                  <p className="text-xs text-muted-foreground">{numberFormat.format(entry.count)} Angaben</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Keine Unverträglichkeiten gemeldet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function humanizePreference(code: string) {
  switch (code) {
    case "acting_scout":
      return "Schnupperrolle";
    case "acting_medium":
      return "Mittlere Rolle";
    case "acting_lead":
      return "Große Rolle";
    case "crew_stage":
      return "Bühnenbild & Ausstattung";
    case "crew_tech":
      return "Licht & Ton";
    case "crew_costume":
      return "Kostüm";
    case "crew_makeup":
      return "Maske & Make-up";
    case "crew_direction":
      return "Regieassistenz & Organisation";
    default:
      return code;
  }
}

function dietaryLabel(level: string) {
  switch (level) {
    case "MILD":
      return "Leicht";
    case "MODERATE":
      return "Mittel";
    case "SEVERE":
      return "Stark";
    case "LETHAL":
      return "Kritisch";
    default:
      return level;
  }
}
