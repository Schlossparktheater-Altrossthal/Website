import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  collectOnboardingAnalytics,
  type OnboardingInterestStat,
  type OnboardingRolePreferenceStat,
  type OnboardingTalentProfile,
  type OnboardingShowSummary,
  type OnboardingShowAggregations,
} from "@/lib/onboarding-analytics";
import { getMysteryScoreboard } from "@/lib/mystery-tips";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

import { RenewOnboardingInviteButton } from "./renew-onboarding-invite-button";
import { OnboardingShowFilter } from "./onboarding-show-filter";

const numberFormat = new Intl.NumberFormat("de-DE");
const percentFormat = new Intl.NumberFormat("de-DE", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const weightFormat = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});
const dateFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });
const dateTimeFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });

type PlanningCandidate = {
  profileId: string;
  name: string;
  weight: number;
  showLabel: string;
  focus: OnboardingTalentProfile["focus"];
  status: "completed" | "open";
};

type PlanningBucket = {
  code: string;
  label: string;
  candidates: PlanningCandidate[];
};

export default async function OnboardingAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.onboarding.analytics");
  if (!allowed) {
    return <div className="text-sm text-red-600">Kein Zugriff auf die Onboarding-Analytics</div>;
  }

  const analytics = await collectOnboardingAnalytics();
  let scoreboard: Awaited<ReturnType<typeof getMysteryScoreboard>>;
  try {
    scoreboard = await getMysteryScoreboard();
  } catch (error) {
    console.error("[onboarding-analytics.scoreboard]", error);
    scoreboard = [];
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const rawShowParam = resolvedSearchParams?.show;
  const selectedShowIdCandidate = Array.isArray(rawShowParam) ? rawShowParam[0] : rawShowParam;
  const selectedShowId = typeof selectedShowIdCandidate === "string" ? selectedShowIdCandidate : null;
  const selectedShow = selectedShowId
    ? analytics.shows.find((show) => show.id === selectedShowId) ?? null
    : null;

  const showFilterOptions = [
    { value: "", label: "Alle Onboardings" },
    ...analytics.shows.map((show) => ({ value: show.id, label: formatShowTitle(show) })),
  ];

  const visibleProfiles = selectedShow
    ? analytics.talentProfiles.filter((profile) => profile.show?.id === selectedShow.id)
    : analytics.talentProfiles;

  const totalProfiles = visibleProfiles.length;
  const completedProfiles = visibleProfiles.filter((profile) => Boolean(profile.completedAt)).length;
  const openProfiles = Math.max(totalProfiles - completedProfiles, 0);

  const focusCounts = visibleProfiles.reduce(
    (acc, profile) => {
      acc[profile.focus] = (acc[profile.focus] ?? 0) + 1;
      return acc;
    },
    { acting: 0, tech: 0, both: 0 } as Record<OnboardingTalentProfile["focus"], number>,
  );
  const totalFocus = Math.max(focusCounts.acting + focusCounts.tech + focusCounts.both, 1);

  const invitesOverview = selectedShow ? selectedShow.invites : analytics.invites;
  const inactiveInvites =
    invitesOverview.expired + invitesOverview.disabled + invitesOverview.exhausted;

  const pendingPhotoConsentsCount = selectedShow
    ? selectedShow.pendingPhotoConsents
    : analytics.pendingPhotoConsents;
  const minorsPendingDocumentsCount = selectedShow
    ? selectedShow.guardianDocumentsMissing
    : analytics.minorsPendingDocuments;

  const interestStats: OnboardingInterestStat[] = selectedShow
    ? selectedShow.interests
    : analytics.interests;
  const rolePreferenceStats: OnboardingRolePreferenceStat[] = selectedShow
    ? selectedShow.rolePreferences
    : analytics.rolePreferences;
  const dietaryStats = selectedShow ? summarizeDietary(visibleProfiles) : analytics.dietary;

  const visibleShowSummaries = selectedShow ? [selectedShow] : analytics.shows;
  const showFilterValue = selectedShow?.id ?? "";

  const summaryByShowId = new Map(analytics.shows.map((show) => [show.id, show] as const));

  const profilesByShow = new Map<
    string,
    { show: OnboardingTalentProfile["show"]; profiles: OnboardingTalentProfile[]; summary: OnboardingShowSummary | null }
  >();
  for (const profile of visibleProfiles) {
    const showId = profile.show?.id ?? "__unassigned";
    if (!profilesByShow.has(showId)) {
      profilesByShow.set(showId, {
        show: profile.show,
        profiles: [],
        summary: profile.show ? summaryByShowId.get(profile.show.id) ?? null : null,
      });
    }
    profilesByShow.get(showId)!.profiles.push(profile);
  }

  const groupedProfiles = Array.from(profilesByShow.values()).sort((a, b) => {
    const aYear = a.show?.year ?? 0;
    const bYear = b.show?.year ?? 0;
    if (aYear !== bYear) return bYear - aYear;
    const aTitle = formatShowTitle(a.show);
    const bTitle = formatShowTitle(b.show);
    return aTitle.localeCompare(bTitle, "de-DE");
  });

  const actingPreferenceCodes = ["acting_lead", "acting_medium", "acting_scout", "acting_statist"];
  const crewPreferenceCodes = [
    "crew_direction",
    "crew_stage",
    "crew_tech",
    "crew_costume",
    "crew_makeup",
    "crew_props",
    "crew_music",
  ];

  const toPlanningCandidate = (
    profile: OnboardingTalentProfile,
    preference: OnboardingTalentProfile["preferences"][number],
  ): PlanningCandidate => ({
    profileId: profile.id,
    name: profile.name ?? profile.email ?? "Unbekannte Person",
    weight: preference.weight,
    showLabel: formatShowTitle(profile.show),
    focus: profile.focus,
    status: profile.completedAt ? "completed" : "open",
  });

  const sortCandidates = (list: PlanningCandidate[]) =>
    list.sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name, "de-DE"));

  const actingCandidateMap = new Map<string, PlanningCandidate[]>();
  const crewCandidateMap = new Map<string, PlanningCandidate[]>();
  const additionalActingCodes = new Set<string>();
  const additionalCrewCodes = new Set<string>();

  for (const code of actingPreferenceCodes) {
    actingCandidateMap.set(code, []);
  }
  for (const code of crewPreferenceCodes) {
    crewCandidateMap.set(code, []);
  }

  for (const profile of visibleProfiles) {
    for (const pref of profile.preferences) {
      if (pref.domain === "acting") {
        if (!actingCandidateMap.has(pref.code)) {
          actingCandidateMap.set(pref.code, []);
          additionalActingCodes.add(pref.code);
        }
        actingCandidateMap.get(pref.code)!.push(toPlanningCandidate(profile, pref));
      }
      if (pref.domain === "crew") {
        if (!crewCandidateMap.has(pref.code)) {
          crewCandidateMap.set(pref.code, []);
          additionalCrewCodes.add(pref.code);
        }
        crewCandidateMap.get(pref.code)!.push(toPlanningCandidate(profile, pref));
      }
    }
  }

  for (const bucket of actingCandidateMap.values()) {
    sortCandidates(bucket);
  }
  for (const bucket of crewCandidateMap.values()) {
    sortCandidates(bucket);
  }

  const actingBucketOrder = [
    ...actingPreferenceCodes,
    ...Array.from(additionalActingCodes).sort((a, b) =>
      humanizePreference(a).localeCompare(humanizePreference(b), "de-DE"),
    ),
  ];
  const crewBucketOrder = [
    ...crewPreferenceCodes,
    ...Array.from(additionalCrewCodes).sort((a, b) =>
      humanizePreference(a).localeCompare(humanizePreference(b), "de-DE"),
    ),
  ];

  const actingPlanningBuckets: PlanningBucket[] = actingBucketOrder.map((code) => ({
    code,
    label: humanizePreference(code),
    candidates: actingCandidateMap.get(code) ?? [],
  }));

  const crewPlanningBuckets: PlanningBucket[] = crewBucketOrder.map((code) => ({
    code,
    label: humanizePreference(code),
    candidates: crewCandidateMap.get(code) ?? [],
  }));

  const showPlanning = groupedProfiles.map(({ show, profiles }) => {
    const actingMap = new Map<string, PlanningCandidate[]>();
    const crewMap = new Map<string, PlanningCandidate[]>();
    const extraActing = new Set<string>();
    const extraCrew = new Set<string>();

    for (const code of actingPreferenceCodes) {
      actingMap.set(code, []);
    }
    for (const code of crewPreferenceCodes) {
      crewMap.set(code, []);
    }

    for (const profile of profiles) {
      for (const pref of profile.preferences) {
        if (pref.domain === "acting") {
          if (!actingMap.has(pref.code)) {
            actingMap.set(pref.code, []);
            extraActing.add(pref.code);
          }
          actingMap.get(pref.code)!.push(toPlanningCandidate(profile, pref));
        }
        if (pref.domain === "crew") {
          if (!crewMap.has(pref.code)) {
            crewMap.set(pref.code, []);
            extraCrew.add(pref.code);
          }
          crewMap.get(pref.code)!.push(toPlanningCandidate(profile, pref));
        }
      }
    }

    for (const bucket of actingMap.values()) {
      sortCandidates(bucket);
    }
    for (const bucket of crewMap.values()) {
      sortCandidates(bucket);
    }

    const actingOrder = [
      ...actingPreferenceCodes,
      ...Array.from(extraActing).sort((a, b) =>
        humanizePreference(a).localeCompare(humanizePreference(b), "de-DE"),
      ),
    ];
    const crewOrder = [
      ...crewPreferenceCodes,
      ...Array.from(extraCrew).sort((a, b) =>
        humanizePreference(a).localeCompare(humanizePreference(b), "de-DE"),
      ),
    ];

    const completedCount = profiles.filter((profile) => profile.completedAt).length;

    return {
      key: show?.id ?? "__unassigned",
      showLabel: formatShowTitle(show),
      profileCount: profiles.length,
      completedCount,
      actingBuckets: actingOrder.map((code) => ({
        code,
        label: humanizePreference(code),
        candidates: actingMap.get(code) ?? [],
      })),
      crewBuckets: crewOrder.map((code) => ({
        code,
        label: humanizePreference(code),
        candidates: crewMap.get(code) ?? [],
      })),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Onboarding Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Überblick über Einladungen, Produktionen und individuelle Antworten aus dem Onboarding-Wizard.
          </p>
        </div>
        <OnboardingShowFilter options={showFilterOptions} value={showFilterValue} />
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Global</TabsTrigger>
          <TabsTrigger value="profiles">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card className="border border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Onboardings gesamt</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{numberFormat.format(totalProfiles)}</p>
                <p className="text-xs text-muted-foreground">
                  {numberFormat.format(completedProfiles)} abgeschlossen · {numberFormat.format(openProfiles)} offen
                </p>
              </CardContent>
            </Card>

            <Card className="border border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Aktive Einladungen</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{numberFormat.format(invitesOverview.active)}</p>
                <p className="text-xs text-muted-foreground">von {numberFormat.format(invitesOverview.total)} insgesamt</p>
              </CardContent>
            </Card>

            <Card className="border border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Abgelaufene Links</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{numberFormat.format(inactiveInvites)}</p>
                <p className="text-xs text-muted-foreground">
                  {numberFormat.format(invitesOverview.expired)} abgelaufen · {numberFormat.format(invitesOverview.disabled)}{" "}
                  deaktiviert · {numberFormat.format(invitesOverview.exhausted)} ausgeschöpft
                </p>
              </CardContent>
            </Card>

            <Card className="border border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Verbrauchte Slots</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{numberFormat.format(invitesOverview.totalUsage)}</p>
                <p className="text-xs text-muted-foreground">registrierte Abschlüsse über den Wizard</p>
              </CardContent>
            </Card>

            <Card className="border border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Fotoeinverständnisse offen</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{numberFormat.format(pendingPhotoConsentsCount)}</p>
                <p className="text-xs text-muted-foreground">Status &bdquo;Pending&ldquo; benötigt Freigabe</p>
              </CardContent>
            </Card>

            <Card className="border border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Elternformulare ausstehend</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{numberFormat.format(minorsPendingDocumentsCount)}</p>
                <p className="text-xs text-muted-foreground">Minderjährige ohne hochgeladenes Elternformular</p>
              </CardContent>
            </Card>
          </section>

          <Card className="border border-border/70">
            <CardHeader>
              <CardTitle>Produktionen &amp; Fortschritt</CardTitle>
              <p className="text-sm text-muted-foreground">
                Zeigt, welche Produktionen aktive Onboardings haben und wo noch Aufgaben offen sind.
              </p>
            </CardHeader>
            <CardContent>
              {visibleShowSummaries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Onboardings erfasst.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border text-sm">
                    <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">Produktion</th>
                        <th className="px-3 py-2 text-left">Onboardings</th>
                        <th className="px-3 py-2 text-left">Abgeschlossen</th>
                        <th className="px-3 py-2 text-left">Offen</th>
                        <th className="px-3 py-2 text-left">Einladungen aktiv</th>
                        <th className="px-3 py-2 text-left">Einladungen offen/ablaufend</th>
                        <th className="px-3 py-2 text-left">Foto-EV offen</th>
                        <th className="px-3 py-2 text-left">Elternformulare</th>
                        <th className="px-3 py-2 text-left">Fokus</th>
                        <th className="px-3 py-2 text-left">Top-Interessen</th>
                        <th className="px-3 py-2 text-left">Top-Präferenzen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                      {visibleShowSummaries.map((show) => (
                        <tr key={show.id} className="bg-background/60">
                          <td className="px-3 py-2 font-medium">{formatShowTitle(show)}</td>
                          <td className="px-3 py-2">{numberFormat.format(show.onboardingCount)}</td>
                          <td className="px-3 py-2 text-success">{numberFormat.format(show.completedCount)}</td>
                          <td className="px-3 py-2 text-warning">{numberFormat.format(show.openCount)}</td>
                          <td className="px-3 py-2">
                            {numberFormat.format(show.invites.active)} / {numberFormat.format(show.invites.total)}
                          </td>
                          <td className="px-3 py-2">
                            {numberFormat.format(show.invites.expired + show.invites.disabled + show.invites.exhausted)}
                          </td>
                          <td className="px-3 py-2">{numberFormat.format(show.pendingPhotoConsents)}</td>
                          <td className="px-3 py-2">{numberFormat.format(show.guardianDocumentsMissing)}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                              <span>S: {numberFormat.format(show.focus.acting)}</span>
                              <span>G: {numberFormat.format(show.focus.tech)}</span>
                              <span>H: {numberFormat.format(show.focus.both)}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {show.interests.length ? (
                              <div className="flex flex-wrap gap-2">
                                {show.interests.slice(0, 3).map((interest) => (
                                  <Badge
                                    key={`${show.id}-interest-${interest.name}`}
                                    variant="muted"
                                    className="justify-start"
                                  >
                                    <span>{interest.name}</span>
                                    <span className="text-[10px] uppercase text-muted-foreground">
                                      {numberFormat.format(interest.count)}
                                    </span>
                                  </Badge>
                                ))}
                                {show.interests.length > 3 ? (
                                  <Badge variant="ghost" className="text-xs text-muted-foreground">
                                    +{numberFormat.format(show.interests.length - 3)} weitere
                                  </Badge>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Keine Angaben</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {show.rolePreferences.length ? (
                              <div className="flex flex-wrap gap-2">
                                {show.rolePreferences.slice(0, 3).map((pref) => (
                                  <Badge
                                    key={`${show.id}-pref-${pref.code}`}
                                    variant="outline"
                                    className="justify-start"
                                  >
                                    <span className="font-medium">{humanizePreference(pref.code)}</span>
                                    <span className="text-[10px] uppercase text-muted-foreground">
                                      {pref.domain === "acting" ? "S" : "G"} · {weightFormat.format(pref.averageWeight)}
                                    </span>
                                  </Badge>
                                ))}
                                {show.rolePreferences.length > 3 ? (
                                  <Badge variant="ghost" className="text-xs text-muted-foreground">
                                    +{numberFormat.format(show.rolePreferences.length - 3)} weitere
                                  </Badge>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Keine Angaben</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border/70">
            <CardHeader>
              <CardTitle>Planung nach Präferenzen</CardTitle>
              <p className="text-sm text-muted-foreground">
                Listen pro Rollengröße und Gewerk, sortiert nach Wunschgewichtung der Talente.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-border/60 bg-background/60 p-4">
                  <PlanningBucketSection
                    heading="Schauspiel · Wunschlisten"
                    buckets={actingPlanningBuckets}
                    emptyLabel="Noch keine Rollenwünsche hinterlegt."
                    variant={selectedShow ? "compact" : "global"}
                  />
                </div>
                <div className="rounded-lg border border-border/60 bg-background/60 p-4">
                  <PlanningBucketSection
                    heading="Gewerke · Wunschlisten"
                    buckets={crewPlanningBuckets}
                    emptyLabel="Noch keine Gewerke-Präferenzen hinterlegt."
                    variant={selectedShow ? "compact" : "global"}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/70">
            <CardHeader>
              <CardTitle>Besetzungsplanung pro Produktion</CardTitle>
              <p className="text-sm text-muted-foreground">
                Kombiniert Wunschlisten mit Produktionen, um finale Platzierungen zu planen.
              </p>
            </CardHeader>
            <CardContent>
              {showPlanning.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Onboardings erfasst.</p>
              ) : (
                <div className="space-y-4">
                  {showPlanning.map((entry) => {
                    const actingTotal = entry.actingBuckets.reduce((sum, bucket) => sum + bucket.candidates.length, 0);
                    const crewTotal = entry.crewBuckets.reduce((sum, bucket) => sum + bucket.candidates.length, 0);

                    return (
                      <div key={entry.key} className="rounded-lg border border-border/60 bg-background/60 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold leading-tight">{entry.showLabel}</p>
                            <p className="text-xs text-muted-foreground">
                              {numberFormat.format(entry.profileCount)} Profile · {numberFormat.format(entry.completedCount)} abgeschlossen
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                              Schauspiel {numberFormat.format(actingTotal)}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                              Gewerke {numberFormat.format(crewTotal)}
                            </Badge>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div className="rounded-md border border-border/50 bg-background p-3">
                            <PlanningBucketSection
                              heading="Schauspiel"
                              buckets={entry.actingBuckets}
                              emptyLabel="Keine Rollenpräferenzen für diese Produktion."
                              variant="compact"
                            />
                          </div>
                          <div className="rounded-md border border-border/50 bg-background p-3">
                            <PlanningBucketSection
                              heading="Gewerke"
                              buckets={entry.crewBuckets}
                              emptyLabel="Keine Gewerke-Präferenzen für diese Produktion."
                              variant="compact"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
                  {Object.entries(focusCounts).map(([focus, count]) => (
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
                {interestStats.length ? (
                  <ul className="space-y-2 text-sm">
                    {interestStats.slice(0, 10).map((interest) => (
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
              <CardTitle>Rollen- &amp; Gewerke-Präferenzen</CardTitle>
              <p className="text-sm text-muted-foreground">Durchschnittliche Gewichtung (0–100) der gewählten Optionen.</p>
            </CardHeader>
            <CardContent>
              {rolePreferenceStats.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="text-left text-xs uppercase text-muted-foreground">
                      <tr className="border-b border-border/70">
                        <th className="px-3 py-2">Bereich</th>
                        <th className="px-3 py-2">Option</th>
                        <th className="px-3 py-2">Ø Gewicht</th>
                        <th className="px-3 py-2">Rückmeldungen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rolePreferenceStats.slice(0, 12).map((entry) => (
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
              {dietaryStats.length ? (
                <div className="flex flex-wrap gap-3">
                  {dietaryStats.map((entry) => (
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
        </TabsContent>

        <TabsContent value="profiles" className="space-y-8">
          {groupedProfiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine abgeschlossenen Onboardings vorhanden.</p>
          ) : (
            groupedProfiles.map(({ show, profiles, summary }) => {
              const showLabel = formatShowTitle(show);
              const completed = summary?.completedCount ?? profiles.filter((profile) => profile.completedAt).length;
              const open = summary?.openCount ?? profiles.filter((profile) => !profile.completedAt).length;

              return (
                <section key={show?.id ?? "unassigned"} className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold">{showLabel}</h2>
                      <p className="text-sm text-muted-foreground">
                        {numberFormat.format(profiles.length)} Profile · {numberFormat.format(completed)} abgeschlossen ·
                        {" "}
                        {numberFormat.format(open)} offen
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {summary ? (
                        <>
                          <Badge variant="success">{numberFormat.format(summary.invites.active)} aktive Links</Badge>
                          {summary.invites.expired + summary.invites.disabled > 0 ? (
                            <Badge variant="warning">
                              {numberFormat.format(summary.invites.expired + summary.invites.disabled)} erneuern
                            </Badge>
                          ) : null}
                          {summary.pendingPhotoConsents > 0 ? (
                            <Badge variant="warning">
                              {numberFormat.format(summary.pendingPhotoConsents)} Foto-EV offen
                            </Badge>
                          ) : null}
                          {summary.guardianDocumentsMissing > 0 ? (
                            <Badge variant="warning">
                              {numberFormat.format(summary.guardianDocumentsMissing)} Elternformulare offen
                            </Badge>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {profiles.map((profile) => (
                      <TalentProfileCard
                        key={profile.id}
                        profile={profile}
                        showSummary={summary ?? undefined}
                        showAggregations={profile.show ? analytics.showAggregations[profile.show.id] : undefined}
                        showLabelVisible={!selectedShow}
                      />
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TalentProfileCard({
  profile,
  showSummary,
  showAggregations,
  showLabelVisible = true,
}: {
  profile: OnboardingTalentProfile;
  showSummary?: OnboardingShowSummary;
  showAggregations?: OnboardingShowAggregations;
  showLabelVisible?: boolean;
}) {
  const name = profile.name ?? profile.email ?? "Unbekannte Person";
  const showLabel = formatShowTitle(profile.show);
  const completionLabel = profile.completedAt
    ? `Abgeschlossen am ${dateFormat.format(new Date(profile.completedAt))}`
    : `Offen seit ${dateFormat.format(new Date(profile.createdAt))}`;
  const topPreferences = profile.preferences.slice(0, 3);
  const remainingPreferences = Math.max(profile.preferences.length - topPreferences.length, 0);
  const interestPreview = profile.interests.slice(0, 6);
  const remainingInterests = Math.max(profile.interests.length - interestPreview.length, 0);
  const allergyPreview = profile.dietaryRestrictions.slice(0, 3);
  const remainingAllergies = Math.max(profile.dietaryRestrictions.length - allergyPreview.length, 0);
  const gender = profile.gender && profile.gender.toLowerCase() !== "keine angabe" ? profile.gender : null;
  const showDietaryPreference = profile.dietaryPreference && profile.dietaryPreference !== "Allesesser:in";
  const dietaryStrictness =
    profile.dietaryPreferenceStrictness && profile.dietaryPreferenceStrictness !== "Nicht relevant"
      ? profile.dietaryPreferenceStrictness
      : null;

  const inviteExpiresAt = profile.invite?.expiresAt ? dateFormat.format(new Date(profile.invite.expiresAt)) : null;
  const showTopInterests = showAggregations?.interests?.slice(0, 3) ?? showSummary?.interests?.slice(0, 3) ?? [];
  const showTopPreferences =
    showAggregations?.rolePreferences?.slice(0, 3) ?? showSummary?.rolePreferences?.slice(0, 3) ?? [];
  const missingInterests = showTopInterests.filter((entry) => !profile.interests.includes(entry.name));
  const missingPreferences = showTopPreferences.filter(
    (entry) => !profile.preferences.some((pref) => pref.code === entry.code),
  );
  const hasShowDemand = showTopInterests.length > 0 || showTopPreferences.length > 0;

  return (
    <div className="rounded-lg border border-border/60 bg-background/60 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span>{name}</span>
            {profile.completedAt ? (
              <Badge variant="success">Abgeschlossen</Badge>
            ) : (
              <Badge variant="warning">Offen</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {profile.email && <span>{profile.email}</span>}
            <span>{completionLabel}</span>
            {showLabelVisible && <span>Produktion: {showLabel}</span>}
            {profile.memberSinceYear && <span>Mitglied seit {profile.memberSinceYear}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{focusLabel(profile.focus)}</Badge>
          {gender && <Badge variant="ghost">{gender}</Badge>}
          {typeof profile.age === "number" && <Badge variant="ghost">{profile.age} Jahre</Badge>}
          {profile.hasPendingPhotoConsent && (
            <Badge variant="warning" className="uppercase tracking-wide">
              Foto-Einverständnis offen
            </Badge>
          )}
          {profile.requiresGuardianDocument && (
            <Badge variant="warning" className="uppercase tracking-wide">
              Elternformular fehlt
            </Badge>
          )}
          {profile.invite ? (
            <Badge
              variant={profile.invite.isActive ? "success" : profile.invite.isExpired ? "warning" : "destructive"}
              className="uppercase tracking-wide"
            >
              {profile.invite.isActive
                ? "Einladung aktiv"
                : profile.invite.isExpired
                  ? "Einladung abgelaufen"
                  : "Einladung deaktiviert"}
            </Badge>
          ) : (
            <Badge variant="outline" className="uppercase tracking-wide">
              Kein Einladungslink
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
      {profile.notes && (
        <p className="mt-2 text-sm text-muted-foreground">Notizen: {profile.notes}</p>
      )}

      {hasShowDemand ? (
        <div className="mt-4 space-y-3 rounded-lg border border-dashed border-warning/40 bg-warning/5 p-3 text-xs md:text-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold uppercase text-muted-foreground">Abgleich mit Produktionsbedarf</p>
            {missingInterests.length + missingPreferences.length > 0 ? (
              <Badge variant="warning" className="uppercase tracking-wide">
                {missingInterests.length + missingPreferences.length} offene Bedarfe
              </Badge>
            ) : (
              <Badge variant="success" className="uppercase tracking-wide">
                Bedarf abgedeckt
              </Badge>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="font-medium text-muted-foreground">Top-Interessen der Produktion</p>
              {showTopInterests.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {showTopInterests.map((entry) => {
                    const matches = profile.interests.includes(entry.name);
                    return (
                      <Badge
                        key={`${profile.id}-show-interest-${entry.name}`}
                        variant={matches ? "success" : "outline"}
                        className="justify-start"
                      >
                        <span>{entry.name}</span>
                        <span className="text-[10px] uppercase text-muted-foreground">
                          {numberFormat.format(entry.count)}
                        </span>
                      </Badge>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-muted-foreground">Keine Interessen priorisiert.</p>
              )}
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Top-Präferenzen der Produktion</p>
              {showTopPreferences.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {showTopPreferences.map((entry) => {
                    const matches = profile.preferences.some((pref) => pref.code === entry.code);
                    return (
                      <Badge
                        key={`${profile.id}-show-pref-${entry.code}`}
                        variant={matches ? "success" : "outline"}
                        className="justify-start"
                      >
                        <span className="font-medium">{humanizePreference(entry.code)}</span>
                        <span className="text-[10px] uppercase text-muted-foreground">
                          {entry.domain === "acting" ? "S" : "G"} · {weightFormat.format(entry.averageWeight)}
                        </span>
                      </Badge>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-muted-foreground">Keine Präferenzen priorisiert.</p>
              )}
            </div>
          </div>
          {missingInterests.length + missingPreferences.length > 0 ? (
            <p className="text-xs text-warning">
              Empfehlung: Mit der Produktion abstimmen, ob zusätzliche Interessen oder Rollenoptionen benötigt werden.
            </p>
          ) : (
            <p className="text-xs text-success">Profil deckt die wichtigsten Produktionsbedarfe ab.</p>
          )}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Präferenzen</p>
          {topPreferences.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {topPreferences.map((pref) => (
                <Badge key={`${profile.userId}-${pref.code}`} variant="outline" className="justify-start">
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
                <Badge key={`${profile.userId}-${interest}`} variant="muted" className="justify-start">
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
                <Badge key={`${profile.userId}-${entry.allergen}`} variant="warning" className="justify-start">
                  <span className="font-medium">{entry.allergen}</span>
                  <span className="text-[10px] uppercase text-muted-foreground">{dietaryLabel(entry.level)}</span>
                </Badge>
              ))}
              {remainingAllergies > 0 && (
                <Badge variant="ghost" className="text-xs text-muted-foreground">
                  +{remainingAllergies} weitere
                </Badge>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Keine Besonderheiten gemeldet.</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-border/60 pt-4 md:flex-row md:items-center md:justify-between">
        {profile.invite ? (
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Einladungslink</p>
            <p>
              {profile.invite.label ? `${profile.invite.label} · ` : null}
              {profile.invite.isActive ? "Aktiv" : profile.invite.isExpired ? "Abgelaufen" : "Deaktiviert"}
            </p>
            {inviteExpiresAt && <p>Gültig bis {inviteExpiresAt}</p>}
            {typeof profile.invite.remainingUses === "number" && (
              <p>Verbleibende Nutzungen: {numberFormat.format(profile.invite.remainingUses)}</p>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Einladungslink</p>
            <p>Für dieses Onboarding ist kein Link hinterlegt.</p>
          </div>
        )}
        <RenewOnboardingInviteButton profileId={profile.id} showLabel={showLabel} invite={profile.invite} />
      </div>
    </div>
  );
}

function formatShowTitle(show: { title: string | null; year: number } | null | undefined) {
  if (!show) return "Ohne Produktion";
  if (show.title && show.title.trim()) return show.title;
  return `Produktion ${show.year}`;
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

function PlanningBucketSection({
  heading,
  buckets,
  emptyLabel,
  variant = "global",
}: {
  heading: string;
  buckets: PlanningBucket[];
  emptyLabel: string;
  variant?: "global" | "compact";
}) {
  const totalCandidates = buckets.reduce((sum, bucket) => sum + bucket.candidates.length, 0);
  const visibleBuckets = buckets.filter((bucket) => bucket.candidates.length > 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
        <span>{heading}</span>
        <span>{numberFormat.format(totalCandidates)}</span>
      </div>
      {totalCandidates === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="space-y-3">
          {visibleBuckets.map((bucket) => (
            <div key={bucket.code} className="space-y-2">
              <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                <span>{bucket.label}</span>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                  {numberFormat.format(bucket.candidates.length)}
                </Badge>
              </div>
              <ul className="space-y-1.5">
                {bucket.candidates.slice(0, 4).map((candidate) => {
                  const metadataParts: string[] = [];
                  if (variant !== "compact") {
                    metadataParts.push(candidate.showLabel);
                  }
                  metadataParts.push(candidate.status === "completed" ? "abgeschlossen" : "offen");
                  metadataParts.push(focusLabel(candidate.focus));

                  return (
                    <li
                      key={`${bucket.code}-${candidate.profileId}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background/70 px-2 py-1.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium leading-tight">{candidate.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{metadataParts.join(" · ")}</p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-[11px]">
                        {weightFormat.format(candidate.weight)}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
              {bucket.candidates.length > 4 ? (
                <p className="text-[11px] text-muted-foreground">
                  +{numberFormat.format(bucket.candidates.length - 4)} weitere
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function summarizeDietary(profiles: OnboardingTalentProfile[]) {
  const counts = new Map<OnboardingTalentProfile["dietaryRestrictions"][number]["level"], number>();
  for (const profile of profiles) {
    for (const entry of profile.dietaryRestrictions) {
      counts.set(entry.level, (counts.get(entry.level) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([level, count]) => ({ level, count }))
    .sort((a, b) => b.count - a.count || a.level.localeCompare(b.level));
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
