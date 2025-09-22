import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { collectOnboardingAnalytics } from "@/lib/onboarding-analytics";
import { getMysteryScoreboard } from "@/lib/mystery-tips";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

const numberFormat = new Intl.NumberFormat("de-DE");
const percentFormat = new Intl.NumberFormat("de-DE", { style: "percent", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });
const dateTimeFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });

export default async function OnboardingAnalyticsPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.onboarding.analytics");
  if (!allowed) {
    return <div className="text-sm text-red-600">Kein Zugriff auf die Onboarding-Analytics</div>;
  }

  const analytics = await collectOnboardingAnalytics();
  const scoreboard = await getMysteryScoreboard();
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

      <Card className="border border-border/70">
        <CardHeader>
          <CardTitle>Mystery Scoreboard</CardTitle>
          <p className="text-sm text-muted-foreground">Top-Spieler:innen mit Punkten für richtige Rätsel-Ideen.</p>
        </CardHeader>
        <CardContent>
          {scoreboard.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Punkte vergeben.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Spielername</th>
                    <th className="px-3 py-2 text-left">Punkte</th>
                    <th className="px-3 py-2 text-left">Richtige Tipps</th>
                    <th className="px-3 py-2 text-left">Zuletzt aktualisiert</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {scoreboard.map((entry) => (
                    <tr key={entry.playerName} className="bg-background/60">
                      <td className="px-3 py-2 font-medium">{entry.playerName}</td>
                      <td className="px-3 py-2 font-semibold">{numberFormat.format(entry.totalScore)}</td>
                      <td className="px-3 py-2">{entry.correctCount}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {entry.lastUpdated ? dateTimeFormat.format(entry.lastUpdated) : "–"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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

      <Card className="border border-border/70">
        <CardHeader>
          <CardTitle>Talentprofile &amp; Matching</CardTitle>
          <p className="text-sm text-muted-foreground">
            Individuelle Onboarding-Antworten, um Rollen nach Interessen und Präferenzen zu besetzen.
          </p>
        </CardHeader>
        <CardContent>
          {analytics.talentProfiles.length ? (
            <div className="space-y-4">
              {analytics.talentProfiles.map((profile) => {
                const name = profile.name ?? profile.email ?? "Unbekannte Person";
                const completionLabel = profile.completedAt
                  ? `Abschluss: ${dateFormat.format(new Date(profile.completedAt))}`
                  : `Erstellt: ${dateFormat.format(new Date(profile.createdAt))}`;
                const topPreferences = profile.preferences.slice(0, 3);
                const remainingPreferences = Math.max(profile.preferences.length - topPreferences.length, 0);
                const interestPreview = profile.interests.slice(0, 5);
                const remainingInterests = Math.max(profile.interests.length - interestPreview.length, 0);
                const allergyPreview = profile.dietaryRestrictions.slice(0, 3);
                const remainingAllergies = Math.max(profile.dietaryRestrictions.length - allergyPreview.length, 0);
                const gender =
                  profile.gender && profile.gender.toLowerCase() !== "keine angabe" ? profile.gender : null;
                const showDietaryPreference =
                  profile.dietaryPreference && profile.dietaryPreference !== "Keine besondere Ernährung";
                const dietaryStrictness =
                  profile.dietaryPreferenceStrictness && profile.dietaryPreferenceStrictness !== "Nicht relevant"
                    ? profile.dietaryPreferenceStrictness
                    : null;

                return (
                  <div key={profile.userId} className="rounded-lg border border-border/60 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">{name}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {profile.email && <span>{profile.email}</span>}
                          <span>{completionLabel}</span>
                          {profile.inviteLabel && <span>Einladung: {profile.inviteLabel}</span>}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{focusLabel(profile.focus)}</Badge>
                        {gender && <Badge variant="ghost">{gender}</Badge>}
                        {typeof profile.age === "number" && <Badge variant="ghost">{profile.age} Jahre</Badge>}
                        {profile.memberSinceYear && (
                          <Badge variant="outline">Mitglied seit {profile.memberSinceYear}</Badge>
                        )}
                        {profile.hasPendingPhotoConsent && (
                          <Badge variant="warning" className="uppercase tracking-wide">
                            Foto-Einverständnis offen
                          </Badge>
                        )}
                      </div>
                    </div>

                    {profile.background && (
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{profile.background}</p>
                    )}
                    {profile.backgroundClass && (
                      <p className="mt-1 text-xs text-muted-foreground">Klasse: {profile.backgroundClass}</p>
                    )}

                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <div>
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Präferenzen</p>
                        {topPreferences.length ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {topPreferences.map((pref) => (
                              <Badge
                                key={`${profile.userId}-${pref.code}`}
                                variant="outline"
                                className="justify-start"
                              >
                                <span className="font-medium">{humanizePreference(pref.code)}</span>
                                <span className="text-[10px] uppercase text-muted-foreground">
                                  {pref.domain === "acting" ? "Schauspiel" : "Gewerke"} · {pref.weight}
                                </span>
                              </Badge>
                            ))}
                            {remainingPreferences > 0 && (
                              <Badge variant="ghost" className="text-xs text-muted-foreground">
                                +{remainingPreferences} weitere
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-muted-foreground">Keine Präferenzen hinterlegt.</p>
                        )}
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Interessen</p>
                        {interestPreview.length ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {interestPreview.map((interest) => (
                              <Badge
                                key={`${profile.userId}-${interest}`}
                                variant="muted"
                                className="justify-start"
                              >
                                {interest}
                              </Badge>
                            ))}
                            {remainingInterests > 0 && (
                              <Badge variant="ghost" className="text-xs text-muted-foreground">
                                +{remainingInterests} weitere
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-muted-foreground">Keine Interessen angegeben.</p>
                        )}
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Ernährung &amp; Allergien</p>
                        {showDietaryPreference || dietaryStrictness || allergyPreview.length ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {showDietaryPreference && (
                              <Badge variant="muted" className="justify-start">
                                {profile.dietaryPreference}
                              </Badge>
                            )}
                            {dietaryStrictness && (
                              <Badge variant="ghost" className="justify-start text-xs text-muted-foreground">
                                {dietaryStrictness}
                              </Badge>
                            )}
                            {allergyPreview.map((entry) => (
                              <Badge
                                key={`${profile.userId}-${entry.allergen}`}
                                variant="warning"
                                className="justify-start"
                              >
                                <span className="font-medium">{entry.allergen}</span>
                                <span className="text-[10px] uppercase text-muted-foreground">
                                  {dietaryLabel(entry.level)}
                                </span>
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-muted-foreground">Keine Besonderheiten gemeldet.</p>
                        )}
                        {remainingAllergies > 0 && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            +{remainingAllergies} weitere Allergien
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Noch keine abgeschlossenen Onboardings vorhanden.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function humanizePreference(code: string) {
  switch (code) {
    case "acting_statist":
      return "Statistenrolle";
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
    case "crew_music":
      return "Musik & Klang";
    case "crew_props":
      return "Requisite";
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

function focusLabel(focus: string) {
  switch (focus) {
    case "acting":
      return "Schauspiel";
    case "tech":
      return "Gewerke";
    case "both":
      return "Hybrid";
    default:
      return focus;
  }
}
