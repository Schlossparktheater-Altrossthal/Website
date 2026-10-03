import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import UserAvatar from "@/components/user-avatar";
import type { MemberStatistics } from "@/lib/analytics/statistics";

import {
  formatDateTime,
  formatDuration,
  formatRelative,
  numberFormat,
  shortRoute,
} from "./statistics-format";

/** Wer war im Zeitraum aktiv – namentlich, nur für Berechtigte der Statistik-Seite. */
export function StatisticsMembers({ statistics }: { statistics: MemberStatistics }) {
  const { members, absentMembers } = statistics.usage;
  const now = new Date(statistics.generatedAt).getTime();

  return (
    <div className="space-y-6">
      <Card className="border border-border/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Zuletzt aktiv · {numberFormat.format(members.length)} Personen
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Besuch = zusammenhängende Nutzung ohne Pause über 30 Minuten. Zeit = Summe der
            Besuchsdauer im Zeitraum.
          </p>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Niemand war im Zeitraum aktiv.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 text-left font-medium">Person</th>
                    <th className="hidden px-2 py-2 text-left font-medium md:table-cell">
                      Zuletzt
                    </th>
                    <th className="px-2 py-2 text-right font-medium">Besuche</th>
                    <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">
                      Seiten
                    </th>
                    <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Zeit</th>
                    <th className="hidden px-2 py-2 text-left font-medium lg:table-cell">Gerät</th>
                    <th className="hidden px-2 py-2 text-left font-medium lg:table-cell">
                      Meist genutzt
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.userId} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <UserAvatar
                            userId={member.userId}
                            email={member.email}
                            name={member.name}
                            avatarSource={member.avatarSource}
                            avatarUpdatedAt={member.avatarUpdatedAt}
                            size={32}
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{member.name}</p>
                            <p
                              className="text-xs text-muted-foreground"
                              title={formatDateTime(member.lastSeen)}
                            >
                              {formatRelative(member.lastSeen, now)}
                              <span className="md:hidden">
                                {member.device ? ` · ${member.device}` : ""}
                              </span>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden whitespace-nowrap px-2 py-2 text-muted-foreground md:table-cell">
                        {formatDateTime(member.lastSeen)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{member.visits}</td>
                      <td className="hidden px-2 py-2 text-right tabular-nums sm:table-cell">
                        {numberFormat.format(member.pageViews)}
                      </td>
                      <td className="hidden whitespace-nowrap px-2 py-2 text-right tabular-nums sm:table-cell">
                        {formatDuration(member.totalTimeMs)}
                      </td>
                      <td className="hidden px-2 py-2 lg:table-cell">{member.device ?? "–"}</td>
                      <td className="hidden max-w-[12rem] truncate px-2 py-2 text-muted-foreground lg:table-cell">
                        {member.topPage ? shortRoute(member.topPage) : "–"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {absentMembers.length ? (
        <Card className="border border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Nicht dagewesen · {numberFormat.format(absentMembers.length)} Personen
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Aktive Konten ohne Besuch in den letzten {statistics.days} Tagen.
            </p>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {absentMembers.map((member) => member.name).join(" · ")}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
