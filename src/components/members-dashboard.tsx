"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  useRealtime,
  useNotificationRealtime,
  useRehearsalRealtime,
} from "@/hooks/useRealtime";
import { useOnlineStats } from "@/hooks/useOnlineStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Activity,
  Calendar,
  Clock,
  Wifi,
  WifiOff,
  Bell,
  CheckCircle2,
  XCircle,
  AlertTriangle,
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
  todayRehearsals: number;
  unreadNotifications: number;
}

const INITIAL_STATS: DashboardStats = {
  totalOnline: 0,
  totalMembers: 0,
  todayRehearsals: 0,
  unreadNotifications: 0,
};

export function MembersDashboard() {
  const { data: session } = useSession();
  const { connectionStatus, isConnected } = useRealtime();
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
        const data = await response.json();
        if (cancelled) return;

        setStats((prev) => ({
          ...prev,
          totalMembers: data?.stats?.totalMembers ?? prev.totalMembers,
          todayRehearsals: data?.stats?.todayRehearsals ?? prev.todayRehearsals,
          unreadNotifications: data?.stats?.unreadNotifications ?? prev.unreadNotifications,
        }));

        const activities: RecentActivity[] = Array.isArray(data?.recentActivities)
          ? data.recentActivities
              .map((activity: any) => ({
                id: String(activity.id ?? activity.timestamp ?? Math.random()),
                type: (activity.type ?? "notification") as RecentActivity["type"],
                message: String(activity.message ?? "Aktualisierung"),
                timestamp: activity.timestamp ? new Date(activity.timestamp) : new Date(),
              }))
              .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          : [];

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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Mitglieder-Dashboard</h1>
        <div className="flex items-center gap-2">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mitglieder gesamt</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMembers}</div>
            <p className="text-xs text-muted-foreground">inkl. Ensemble und Technik</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Heutige Proben</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayRehearsals}</div>
            <p className="text-xs text-muted-foreground">Termine zwischen 00:00 und 23:59 Uhr</p>
          </CardContent>
        </Card>

        <Card>
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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle>Aktive Mitglieder</CardTitle>
            <p className="text-sm text-muted-foreground">
              Wer ist gerade online? Live-Ansicht aktualisiert über WebSockets.
            </p>
          </CardHeader>
          <CardContent>
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

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle>Aktivitäten</CardTitle>
            <p className="text-sm text-muted-foreground">
              Neueste Proben, Zusagen und Benachrichtigungen.
            </p>
          </CardHeader>
          <CardContent>
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
