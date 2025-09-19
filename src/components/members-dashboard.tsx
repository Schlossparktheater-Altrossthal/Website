"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  useRealtime,
  useNotificationRealtime,
  useRehearsalRealtime,
} from "@/hooks/useRealtime";
import { useOnlineStats } from "@/hooks/useOnlineStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Activity,
  Calendar,
  Wifi,
  WifiOff,
  Bell,
  CheckCircle2,
} from "lucide-react";

interface RecentActivity {
  id: string;
  type: "notification" | "rehearsal" | "attendance";
  message: string;
  timestamp: Date;
}

interface DashboardStats {
  totalOnline: number;
  totalMembers: number;
  rehearsalsThisWeek: number;
  unreadNotifications: number;
}

const INITIAL_STATS: DashboardStats = {
  totalOnline: 0,
  totalMembers: 0,
  rehearsalsThisWeek: 0,
  unreadNotifications: 0,
};

type OverviewStatsPayload = {
  totalMembers?: unknown;
  rehearsalsThisWeek?: unknown;
  unreadNotifications?: unknown;
};

type OverviewResponse = {
  stats?: OverviewStatsPayload;
  recentActivities?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseRecentActivities(value: unknown): RecentActivity[] {
  if (!Array.isArray(value)) return [];

  const fallbackTimestamp = () => new Date();

  return value
    .map((entry) => {
      if (!isRecord(entry)) return null;

      const rawId = entry.id;
      const rawType = entry.type;
      const rawMessage = entry.message;
      const rawTimestamp = entry.timestamp;

      const timestampCandidate =
        typeof rawTimestamp === "string" || rawTimestamp instanceof Date
          ? new Date(rawTimestamp)
          : fallbackTimestamp();
      const timestamp = Number.isNaN(timestampCandidate.getTime())
        ? fallbackTimestamp()
        : timestampCandidate;

      let id: string;
      if (typeof rawId === "string" && rawId.trim()) {
        id = rawId;
      } else if (typeof rawId === "number" && Number.isFinite(rawId)) {
        id = String(rawId);
      } else {
        id = `activity_${timestamp.getTime()}`;
      }

      const message = typeof rawMessage === "string" && rawMessage.trim()
        ? rawMessage
        : "Aktualisierung";

      const type: RecentActivity["type"] =
        rawType === "rehearsal" || rawType === "attendance" || rawType === "notification"
          ? rawType
          : "notification";

      return { id, type, message, timestamp } satisfies RecentActivity;
    })
    .filter((entry): entry is RecentActivity => entry !== null)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export function MembersDashboard() {
  const { data: session } = useSession();
  const { connectionStatus } = useRealtime();
  const {
    totalOnline: liveOnline,
    onlineUsers,
    isLoading: onlineLoading,
  } = useOnlineStats();

  const [stats, setStats] = useState<DashboardStats>(INITIAL_STATS);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setStats((prev) => ({ ...prev, totalOnline: liveOnline }));
  }, [liveOnline]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const response = await fetch("/api/dashboard/overview", { cache: "no-store" });
        if (!response.ok) {
          console.error("[Dashboard] Failed to load overview", response.status);
          return;
        }
        const payload = (await response.json()) as OverviewResponse;
        if (cancelled) return;

        setStats((prev) => {
          const statsPayload = isRecord(payload?.stats) ? payload.stats : {};
          const next: DashboardStats = {
            totalOnline: prev.totalOnline,
            totalMembers:
              typeof statsPayload.totalMembers === "number"
                ? statsPayload.totalMembers
                : prev.totalMembers,
            rehearsalsThisWeek:
              typeof statsPayload.rehearsalsThisWeek === "number"
                ? statsPayload.rehearsalsThisWeek
                : prev.rehearsalsThisWeek,
            unreadNotifications:
              typeof statsPayload.unreadNotifications === "number"
                ? statsPayload.unreadNotifications
                : prev.unreadNotifications,
          };
          return next;
        });

        const activities = parseRecentActivities(payload?.recentActivities);

        setRecentActivities(activities.slice(0, 10));
      } catch (error) {
        console.error("[Dashboard] Error loading overview", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const addActivity = useCallback((activity: RecentActivity) => {
    setRecentActivities((prev) => {
      const filtered = prev.filter((entry) => entry.id !== activity.id);
      return [activity, ...filtered].slice(0, 10);
    });
  }, []);

  useNotificationRealtime((event) => {
    const activity: RecentActivity = {
      id: event.notification.id ?? `notification_${Date.now()}`,
      type: "notification",
      message: event.notification.title,
      timestamp: new Date(event.timestamp ?? Date.now()),
    };

    addActivity(activity);
    setStats((prev) => ({ ...prev, unreadNotifications: prev.unreadNotifications + 1 }));
  });

  useRehearsalRealtime(
    (event) => {
      const activity: RecentActivity = {
        id: `rehearsal_${event.rehearsal.id}_${Date.now()}`,
        type: "rehearsal",
        message: `Neue Probe: ${event.rehearsal.title}`,
        timestamp: new Date(event.timestamp ?? Date.now()),
      };
      addActivity(activity);
    },
    (event) => {
      const activity: RecentActivity = {
        id: `rehearsal_update_${event.rehearsalId}_${Date.now()}`,
        type: "rehearsal",
        message: `Probe aktualisiert: ${event.rehearsalId}`,
        timestamp: new Date(event.timestamp ?? Date.now()),
      };
      addActivity(activity);
    },
  );

  const getActivityIcon = useCallback((type: RecentActivity["type"]) => {
    switch (type) {
      case "attendance":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "rehearsal":
        return <Calendar className="h-4 w-4 text-blue-500" />;
      case "notification":
      default:
        return <Bell className="h-4 w-4 text-purple-500" />;
    }
  }, []);

  const formatTimeAgo = useCallback((date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "gerade eben";
    if (diffInSeconds < 3600) return `vor ${Math.floor(diffInSeconds / 60)} Min`;
    if (diffInSeconds < 86400) return `vor ${Math.floor(diffInSeconds / 3600)} Std`;
    return `vor ${Math.floor(diffInSeconds / 86400)} Tag(en)`;
  }, []);

  const onlineList = useMemo(() => onlineUsers.slice(0, 6), [onlineUsers]);

  if (!session?.user) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Bitte melden Sie sich an, um das Mitglieder-Dashboard zu sehen.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:space-y-8 lg:p-0 lg:pt-2 lg:pb-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-3xl font-bold">Mitglieder-Dashboard</h1>
        <div className="flex flex-wrap items-center gap-2">
          {connectionStatus === "connected" ? (
            <>
              <Wifi className="h-5 w-5 text-green-500" />
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                Live verbunden
              </Badge>
            </>
          ) : (
            <>
              <WifiOff className="h-5 w-5 text-red-500" />
              <Badge variant="destructive">{connectionStatus === "error" ? "Verbindungsfehler" : "Offline"}</Badge>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.6fr)_minmax(0,0.4fr)] xl:items-stretch">
        {/* Willkommen/Quick Actions */}
        <Card className="h-full bg-gradient-to-br from-accent/20 to-transparent">
          <CardContent className="flex h-full flex-col gap-4 pt-6 md:flex-row md:items-center md:justify-between xl:gap-6">
            <div>
              <div className="text-sm text-muted-foreground">Willkommen zurück</div>
              <h2 className="text-xl font-semibold">
                {session?.user?.name || session?.user?.email || "Mitglied"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Hier findest du aktuelle Aktivitäten und schnelle Aktionen.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(() => {
                const userRoles = (session?.user?.roles as string[] | undefined) ?? (session?.user?.role ? [session.user.role] : []);
                const roleSet = new Set(userRoles);
                const links = [
                  { href: "/mitglieder/profil", label: "Profil öffnen" },
                  { href: "/mitglieder/meine-proben", label: "Meine Proben" },
                  { href: "/mitglieder/probenplanung", label: "Probenplanung", roles: ["board", "admin", "tech", "owner"] },
                  { href: "/mitglieder/mitgliederverwaltung", label: "Mitgliederverwaltung", roles: ["admin", "owner"] },
                  { href: "/mitglieder/rechte", label: "Rechteverwaltung", roles: ["admin", "owner"] },
                ].filter((l: { href: string; label: string; roles?: string[] }) => !l.roles || l.roles.some((r) => roleSet.has(r)));
                return links.map((l) => (
                  <Button asChild key={l.href} variant="outline" size="sm">
                    <Link href={l.href}>{l.label}</Link>
                  </Button>
                ));
              })()}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:auto-rows-fr xl:grid-cols-2">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Online Mitglieder</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.totalOnline}
              </div>
              <p className="text-xs text-muted-foreground">
                Aktualisiert {onlineLoading ? "…" : `vor ${formatTimeAgo(new Date())}`}
              </p>
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Mitglieder gesamt</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalMembers}</div>
              <p className="text-xs text-muted-foreground">inkl. Ensemble und Technik</p>
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Proben diese Woche</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.rehearsalsThisWeek}</div>
              <p className="text-xs text-muted-foreground">Termine der laufenden Kalenderwoche</p>
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ungelesene Benachrichtigungen</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.unreadNotifications}</div>
              <p className="text-xs text-muted-foreground">Wer zuerst liest, ist informiert</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.45fr)_minmax(0,0.55fr)] xl:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] xl:gap-6">
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle>Aktive Mitglieder</CardTitle>
            <p className="text-sm text-muted-foreground">
              Wer ist gerade online? Live-Ansicht aktualisiert über WebSockets.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {onlineList.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {onlineLoading ? "Lade Live-Daten …" : "Derzeit ist niemand online."}
              </p>
            ) : (
              <ul className="space-y-3">
                {onlineList.map((user) => (
                  <li key={`${user.id}-${user.joinedAt.getTime()}`} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                      <span className="text-sm font-medium">{user.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(user.joinedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle>Aktivitäten</CardTitle>
            <p className="text-sm text-muted-foreground">
              Neueste Proben, Zusagen und Benachrichtigungen.
            </p>
          </CardHeader>
          <CardContent className="flex h-full flex-col">
            {isLoading && recentActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground">Lade Aktivitäten …</p>
            ) : recentActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Aktivitäten erfasst.</p>
            ) : (
              <ul className="space-y-3">
                {recentActivities.map((activity) => (
                  <li key={`${activity.id}-${activity.timestamp.getTime()}`} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.message}</p>
                      <p className="text-xs text-muted-foreground">{formatTimeAgo(activity.timestamp)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
