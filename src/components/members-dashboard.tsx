"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
  MembersContentHeader,
  MembersContentLayout,
  MembersTopbar,
  MembersTopbarStatus,
  MembersTopbarTitle,
} from "@/components/members/members-app-shell";
import { useMembersPermissions } from "@/components/members/permissions-context";
import { PageHeader, PageHeaderDescription, PageHeaderStatus, PageHeaderTitle } from "@/design-system/patterns";
import {
  Users,
  Activity,
  Calendar,
  Wifi,
  WifiOff,
  Bell,
  CheckCircle2,
  Sparkles,
  UserRound,
  CalendarCheck,
  CalendarCog,
  UsersRound,
  ShieldCheck,
  Hammer,
  PiggyBank,
  CalendarRange,
  UtensilsCrossed,
  ArrowUpRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface FinalRehearsalWeekInfo {
  showId: string;
  title: string | null;
  year: number;
  startDate: Date;
}

const INITIAL_STATS: DashboardStats = {
  totalOnline: 0,
  totalMembers: 0,
  rehearsalsThisWeek: 0,
  unreadNotifications: 0,
};

type QuickActionLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  permissionKey?: string;
};

type MetricTone = "neutral" | "accent" | "positive" | "warning" | "destructive";

type MetricItem = {
  key: string;
  label: string;
  value: string;
  hint?: string | null;
  icon: ReactNode;
  tone: MetricTone;
};

const DASHBOARD_CARD_SURFACE =
  "rounded-3xl border border-border/60 bg-gradient-to-br from-background via-background/95 to-background shadow-lg shadow-primary/5 backdrop-blur";

const DASHBOARD_CARD_ACCENT =
  "rounded-3xl border border-primary/45 bg-gradient-to-br from-primary/12 via-background/95 to-background shadow-xl shadow-primary/10 backdrop-blur";

const METRIC_CARD_CLASSES: Record<MetricTone, string> = {
  neutral:
    "border-border/60 bg-gradient-to-br from-background via-background/95 to-background shadow-lg shadow-primary/5 backdrop-blur",
  accent:
    "border-primary/50 bg-gradient-to-br from-primary/18 via-primary/10 to-background shadow-xl shadow-primary/10 text-primary",
  positive:
    "border-success/50 bg-gradient-to-br from-success/18 via-success/10 to-background shadow-xl text-success",
  warning:
    "border-warning/50 bg-gradient-to-br from-warning/18 via-warning/10 to-background shadow-xl text-warning",
  destructive:
    "border-destructive/50 bg-gradient-to-br from-destructive/18 via-destructive/10 to-background shadow-xl text-destructive",
};

const METRIC_ICON_CLASSES: Record<MetricTone, string> = {
  neutral: "border-border/50 bg-background/80 text-muted-foreground",
  accent: "border-primary/40 bg-primary/15 text-primary",
  positive: "border-success/45 bg-success/15 text-success",
  warning: "border-warning/45 bg-warning/15 text-warning",
  destructive: "border-destructive/45 bg-destructive/15 text-destructive",
};

interface MembersDashboardProps {
  permissions?: readonly string[];
}

type ActiveProductionOverview = {
  id: string;
  title: string | null;
  year: number;
};

type ProductionMembershipSummary = {
  showId: string;
  title: string | null;
  year: number;
  joinedAt: Date | null;
  leftAt: Date | null;
  isActive: boolean;
};

const QUICK_ACTION_LINKS = [
  {
    href: "/mitglieder/profil",
    label: "Profil öffnen",
    icon: UserRound,
    permissionKey: "mitglieder.profil",
  },
  {
    href: "/mitglieder/meine-proben",
    label: "Meine Proben",
    icon: CalendarCheck,
    permissionKey: "mitglieder.meine-proben",
  },
  {
    href: "/mitglieder/meine-gewerke",
    label: "Meine Gewerke",
    icon: Hammer,
    permissionKey: "mitglieder.meine-gewerke",
  },
  {
    href: "/mitglieder/finanzen",
    label: "Finanzen",
    icon: PiggyBank,
    permissionKey: "mitglieder.finanzen",
  },
  {
    href: "/mitglieder/probenplanung",
    label: "Probenplanung",
    icon: CalendarCog,
    permissionKey: "mitglieder.probenplanung",
  },
  {
    href: "/mitglieder/endproben-woche/dienstplan",
    label: "Endproben-Woche",
    icon: CalendarRange,
    permissionKey: "mitglieder.endprobenwoche",
  },
  {
    href: "/mitglieder/endproben-woche/essenplanung",
    label: "Essensplanung",
    icon: UtensilsCrossed,
    permissionKey: "mitglieder.essenplanung",
  },
  {
    href: "/mitglieder/mitgliederverwaltung",
    label: "Mitgliederverwaltung",
    icon: UsersRound,
    permissionKey: "mitglieder.rollenverwaltung",
  },
  {
    href: "/mitglieder/rechte",
    label: "Rechteverwaltung",
    icon: ShieldCheck,
    permissionKey: "mitglieder.rechte",
  },
] satisfies QuickActionLink[];

type OverviewStatsPayload = {
  totalMembers?: unknown;
  rehearsalsThisWeek?: unknown;
  unreadNotifications?: unknown;
};

type OverviewResponse = {
  stats?: OverviewStatsPayload;
  recentActivities?: unknown;
  finalRehearsalWeek?: unknown;
  profileCompletion?: unknown;
  activeProduction?: unknown;
  productionMemberships?: unknown;
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

function parseIsoDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed;
    }
  }
  return null;
}

function parseFinalRehearsalWeek(value: unknown): FinalRehearsalWeekInfo | null {
  if (!isRecord(value)) return null;

  const rawShowId = value.showId;
  if (typeof rawShowId !== "string") return null;
  const showId = rawShowId.trim();
  if (!showId) return null;

  const startDate = parseIsoDate(value.startDate);
  if (!startDate) return null;

  const title = typeof value.title === "string" && value.title.trim() ? value.title : null;
  const yearRaw = value.year;
  const year =
    typeof yearRaw === "number" && Number.isFinite(yearRaw)
      ? yearRaw
      : startDate.getFullYear();

  return {
    showId,
    title,
    year,
    startDate,
  };
}

function parseProfileCompletion(value: unknown):
  | { complete: boolean; completed: number; total: number }
  | null {
  if (!isRecord(value)) return null;
  const totalRaw = value.total;
  const completedRaw = value.completed;
  const complete = Boolean(value.complete);
  const total =
    typeof totalRaw === "number" && Number.isFinite(totalRaw) ? totalRaw : 0;
  const completed =
    typeof completedRaw === "number" && Number.isFinite(completedRaw)
      ? completedRaw
      : 0;
  return { complete, completed, total };
}

function parseActiveProduction(value: unknown): ActiveProductionOverview | null {
  if (!isRecord(value)) {
    return null;
  }

  const rawId = value.id;
  const rawTitle = value.title;
  const rawYear = value.year;

  if (typeof rawId !== "string" || !rawId) {
    return null;
  }

  if (typeof rawYear !== "number" || !Number.isFinite(rawYear)) {
    return null;
  }

  const title = typeof rawTitle === "string" && rawTitle.trim() ? rawTitle : null;

  return { id: rawId, title, year: rawYear } satisfies ActiveProductionOverview;
}

function parseProductionMemberships(value: unknown): ProductionMembershipSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      const rawShowId = entry.showId;
      const rawTitle = entry.title;
      const rawYear = entry.year;
      const rawJoinedAt = entry.joinedAt;
      const rawLeftAt = entry.leftAt;
      const rawIsActive = entry.isActive;

      if (typeof rawShowId !== "string" || !rawShowId) {
        return null;
      }

      if (typeof rawYear !== "number" || !Number.isFinite(rawYear)) {
        return null;
      }

      const title = typeof rawTitle === "string" && rawTitle.trim() ? rawTitle : null;
      const joinedAt = parseIsoDate(rawJoinedAt);
      const leftAt = parseIsoDate(rawLeftAt);
      const isActive = Boolean(rawIsActive);

      return {
        showId: rawShowId,
        title,
        year: rawYear,
        joinedAt,
        leftAt,
        isActive,
      } satisfies ProductionMembershipSummary;
    })
    .filter((entry): entry is ProductionMembershipSummary => entry !== null);
}

function formatProductionName(entry: { title: string | null; year: number }) {
  if (entry.title && entry.title.trim()) {
    return `${entry.title} (${entry.year})`;
  }
  return `Produktion ${entry.year}`;
}

function formatDateLocalized(date: Date | null) {
  if (!date) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(date);
  } catch {
    return null;
  }
}

export function MembersDashboard({ permissions: permissionsProp }: MembersDashboardProps = {}) {
  const { data: session } = useSession();
  const { connectionStatus } = useRealtime();
  const {
    totalOnline: liveOnline,
    onlineUsers,
    isLoading: onlineLoading,
  } = useOnlineStats();
  const contextPermissions = useMembersPermissions();
  const effectivePermissions = permissionsProp ?? contextPermissions;
  const canAccessProductions =
    effectivePermissions?.includes("mitglieder.produktionen") ?? false;

  const [stats, setStats] = useState<DashboardStats>(INITIAL_STATS);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [finalRehearsalWeek, setFinalRehearsalWeek] = useState<FinalRehearsalWeekInfo | null>(null);
  const [profileCompletion, setProfileCompletion] = useState<
    { complete: boolean; completed: number; total: number } | null
  >(null);
  const [activeProduction, setActiveProduction] = useState<ActiveProductionOverview | null>(null);
  const [productionMemberships, setProductionMemberships] = useState<ProductionMembershipSummary[]>([]);
  const [activeProductionLoaded, setActiveProductionLoaded] = useState(false);
  const [activeProductionError, setActiveProductionError] = useState(false);

  useEffect(() => {
    setStats((prev) => ({ ...prev, totalOnline: liveOnline }));
  }, [liveOnline]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setActiveProductionError(false);
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

        setFinalRehearsalWeek(parseFinalRehearsalWeek(payload?.finalRehearsalWeek));
        setProfileCompletion(parseProfileCompletion(payload?.profileCompletion));
        setActiveProduction(parseActiveProduction(payload?.activeProduction));
        setProductionMemberships(parseProductionMemberships(payload?.productionMemberships));
        const activities = parseRecentActivities(payload?.recentActivities);

        setRecentActivities(activities.slice(0, 10));
      } catch (error) {
        console.error("[Dashboard] Error loading overview", error);
        setActiveProductionError(true);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setActiveProductionLoaded(true);
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
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "rehearsal":
        return <Calendar className="h-4 w-4 text-info" />;
      case "notification":
      default:
        return <Bell className="h-4 w-4 text-accent" />;
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

  const availableQuickActions = useMemo(() => {
    if (!effectivePermissions.length) {
      return QUICK_ACTION_LINKS.filter((link) => !link.permissionKey);
    }

    const permissionSet = new Set(effectivePermissions);
    return QUICK_ACTION_LINKS.filter(
      (link) => !link.permissionKey || permissionSet.has(link.permissionKey),
    );
  }, [effectivePermissions]);

  const quickActions = useMemo(() => availableQuickActions.slice(0, 6), [availableQuickActions]);

  const connectionMeta = useMemo(() => {
    if (connectionStatus === "connected") {
      return {
        state: "online" as const,
        icon: <Wifi className="h-4 w-4" />,
        label: "Live verbunden",
      };
    }

    if (connectionStatus === "error") {
      return {
        state: "error" as const,
        icon: <WifiOff className="h-4 w-4" />,
        label: "Verbindungsfehler",
      };
    }

    if (connectionStatus === "connecting") {
      return {
        state: "warning" as const,
        icon: <Wifi className="h-4 w-4 animate-pulse" />,
        label: "Verbindung wird aufgebaut",
      };
    }

    return {
      state: "offline" as const,
      icon: <WifiOff className="h-4 w-4" />,
      label: "Offline",
    };
  }, [connectionStatus]);

  const connectionToneClasses: Record<"online" | "offline" | "warning" | "error", string> = {
    online:
      "border-success/50 bg-gradient-to-r from-success/20 via-success/10 to-success/5 text-success",
    warning:
      "border-warning/50 bg-gradient-to-r from-warning/18 via-warning/10 to-warning/5 text-warning",
    error:
      "border-destructive/50 bg-gradient-to-r from-destructive/15 via-destructive/10 to-destructive/5 text-destructive",
    offline:
      "border-border/60 bg-gradient-to-r from-muted/20 via-background/85 to-background text-muted-foreground",
  };
  const connectionBadgeClass = connectionToneClasses[connectionMeta.state];

  const activeMembership = useMemo(() => {
    if (!activeProduction) {
      return null;
    }

    return (
      productionMemberships.find((entry) => entry.showId === activeProduction.id) ?? null
    );
  }, [activeProduction, productionMemberships]);

  const otherMemberships = useMemo(() => {
    if (productionMemberships.length === 0) {
      return [] as ProductionMembershipSummary[];
    }

    if (!activeProduction) {
      return productionMemberships;
    }

    return productionMemberships.filter((entry) => entry.showId !== activeProduction.id);
  }, [activeProduction, productionMemberships]);

  const finalRehearsalMetric = useMemo(() => {
    if (!finalRehearsalWeek) return null;

    const startDate = finalRehearsalWeek.startDate;
    const showLabel = finalRehearsalWeek.title
      ? finalRehearsalWeek.title
      : `Produktion ${finalRehearsalWeek.year}`;
    const formattedDate = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(startDate);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const diffMs = startDay.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      let tone: "info" | "warning" | "destructive" = "info";
      if (diffDays <= 3) {
        tone = "destructive";
      } else if (diffDays <= 7) {
        tone = "warning";
      }
      return {
        label: "Tage bis Endprobenwoche",
        value: diffDays,
        hint: `${showLabel} · Start am ${formattedDate}`,
        tone,
      } as const;
    }

    if (diffDays === 0) {
      return {
        label: "Endprobenwoche",
        value: "Heute",
        hint: `${showLabel} · Start am ${formattedDate}`,
        tone: "warning" as const,
      };
    }

    return {
      label: "Endprobenwoche",
      value: "Gestartet",
      hint: `${showLabel} · Start am ${formattedDate}`,
      tone: "positive" as const,
    };
  }, [finalRehearsalWeek]);

  const numberFormatter = useMemo(() => new Intl.NumberFormat("de-DE"), []);

  const onlineUpdatedHint = onlineLoading
    ? "Aktualisiert …"
    : `Aktualisiert ${formatTimeAgo(new Date())}`;

  const metrics = useMemo(() => {
    const items: MetricItem[] = [
      {
        key: "online",
        label: "Online Mitglieder",
        value: numberFormatter.format(stats.totalOnline),
        hint: onlineUpdatedHint,
        icon: <Users className="h-4 w-4" />,
        tone: "positive",
      },
      {
        key: "members",
        label: "Mitglieder gesamt",
        value: numberFormatter.format(stats.totalMembers),
        hint: "inkl. Ensemble und Technik",
        icon: <Activity className="h-4 w-4" />,
        tone: "neutral",
      },
      {
        key: "rehearsals",
        label: "Proben diese Woche",
        value: numberFormatter.format(stats.rehearsalsThisWeek),
        hint: "Termine der laufenden Kalenderwoche",
        icon: <Calendar className="h-4 w-4" />,
        tone: "accent",
      },
      {
        key: "notifications",
        label: "Ungelesene Benachrichtigungen",
        value: numberFormatter.format(stats.unreadNotifications),
        hint: "Wer zuerst liest, ist informiert",
        icon: <Bell className="h-4 w-4" />,
        tone: stats.unreadNotifications > 0 ? "warning" : "neutral",
      },
    ];

    if (finalRehearsalMetric) {
      const rehearsalTone: MetricTone =
        finalRehearsalMetric.tone === "destructive"
          ? "destructive"
          : finalRehearsalMetric.tone === "warning"
            ? "warning"
            : finalRehearsalMetric.tone === "positive"
              ? "positive"
              : "accent";

      items.unshift({
        key: "final-rehearsal",
        label: finalRehearsalMetric.label,
        value:
          typeof finalRehearsalMetric.value === "number"
            ? numberFormatter.format(finalRehearsalMetric.value)
            : finalRehearsalMetric.value,
        hint: finalRehearsalMetric.hint,
        icon: <Sparkles className="h-4 w-4" />,
        tone: rehearsalTone,
      });
    }

    return items;
  }, [
    finalRehearsalMetric,
    numberFormatter,
    onlineUpdatedHint,
    stats.rehearsalsThisWeek,
    stats.totalMembers,
    stats.totalOnline,
    stats.unreadNotifications,
  ]);

  const profileReminder = useMemo(() => {
    if (!profileCompletion) {
      return null;
    }

    const remaining = Math.max(profileCompletion.total - profileCompletion.completed, 0);

    if (!profileCompletion.complete) {
      return (
        <div className="flex flex-col gap-3 rounded-2xl border border-warning/50 bg-gradient-to-br from-warning/20 via-warning/10 to-warning/5 p-4 text-sm text-warning">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl border border-warning/50 bg-warning/20">
              <CalendarRange className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold">Profilangaben unvollständig</p>
              <p className="text-xs text-warning/90">
                {`Noch ${remaining} von ${profileCompletion.total} Aufgaben offen.`}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-warning/45 bg-gradient-to-r from-warning/20 via-warning/10 to-warning/5 text-warning transition hover:border-warning/60 hover:bg-warning/15"
            asChild
          >
            <Link href="/mitglieder/profil">Profil aktualisieren</Link>
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-start gap-3 rounded-2xl border border-success/50 bg-gradient-to-br from-success/20 via-success/10 to-success/5 p-4 text-sm text-success">
        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl border border-success/50 bg-success/20">
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <div>
          <p className="font-semibold">Profil vollständig</p>
          <p className="text-xs text-success/90">Alle Angaben sind auf dem aktuellen Stand.</p>
        </div>
      </div>
    );
  }, [profileCompletion]);

  const activeProductionCard = useMemo(() => {
    if (!activeProductionLoaded) {
      return (
        <Card className="rounded-3xl border border-dashed border-border/60 bg-card shadow-sm">
          <CardContent className="space-y-3 p-6">
            <div className="h-4 w-32 rounded bg-muted/50" />
            <div className="h-5 w-48 rounded bg-muted/40" />
            <div className="h-3 w-full rounded bg-muted/30" />
          </CardContent>
        </Card>
      );
    }

    if (activeProductionError) {
      return (
        <Card className="rounded-3xl border border-destructive/40 bg-destructive/10 text-destructive shadow-sm">
          <CardContent className="space-y-2 p-6">
            <p className="text-sm font-semibold">Aktive Produktion konnte nicht geladen werden.</p>
            <p className="text-xs text-destructive/80">
              Bitte lade die Seite neu oder versuche es später erneut.
            </p>
          </CardContent>
        </Card>
      );
    }

    const membershipSectionTitle = activeProduction ? "Weitere Produktionen" : "Bisherige Produktionen";

    const membershipBadges = otherMemberships.length
      ? (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {membershipSectionTitle}
            </p>
            <div className="flex flex-wrap gap-2">
              {otherMemberships.slice(0, 4).map((membership) => {
                const label = formatProductionName(membership);
                const leftLabel = formatDateLocalized(membership.leftAt);
                const statusText = membership.isActive
                  ? "aktiv"
                  : leftLabel
                    ? `bis ${leftLabel}`
                    : "archiviert";

                return (
                  <Badge
                    key={`membership-${membership.showId}`}
                    variant="outline"
                    className={cn(
                      "border-border/60 bg-card text-foreground",
                      membership.isActive && "border-primary/40 bg-primary/10 text-primary",
                    )}
                  >
                    <span className="font-medium">{label}</span>
                    <span className="ml-1 text-[11px] text-muted-foreground">• {statusText}</span>
                  </Badge>
                );
              })}
            </div>
            {otherMemberships.length > 4 ? (
              <p className="text-[11px] text-muted-foreground">
                + {otherMemberships.length - 4} weitere im Archiv
              </p>
            ) : null}
          </div>
        )
      : null;

    const sharedNote = (
      <p className="text-xs text-muted-foreground">
        Profilangaben wie Maße, Allergien und Einverständnisse gelten produktonsübergreifend und müssen nicht
        erneut erfasst werden.
      </p>
    );

    if (!activeProduction) {
      return (
        <Card className="rounded-3xl border border-dashed border-primary/40 bg-primary/5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg font-semibold text-primary">Keine aktive Produktion ausgewählt</CardTitle>
            <p className="text-sm text-muted-foreground">
              Wähle eine aktive Produktion, um Rollen, Szenen und Gewerke der aktuellen Saison zu sehen.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sobald du nur einer laufenden Produktion angehörst oder frühere Produktionen ausgelaufen sind, setzen wir
              deine Mitgliedschaft automatisch auf die aktuelle Produktion.
            </p>
            {membershipBadges}
            {sharedNote}
            {canAccessProductions ? (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button asChild size="sm">
                  <Link href="/mitglieder/produktionen">Zur Produktionsübersicht</Link>
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      );
    }

    const productionLabel = formatProductionName(activeProduction);
    const membership = activeMembership;
    const joinedLabel = formatDateLocalized(membership?.joinedAt ?? null);
    const leftLabel = formatDateLocalized(membership?.leftAt ?? null);
    const statusBadgeLabel = membership?.isActive === false ? "Archiviert" : "Aktiv";
    const statusBadgeClass =
      membership?.isActive === false
        ? "border-border/60 text-muted-foreground"
        : "border-primary/40 bg-primary/10 text-primary";

    let membershipSubtitle: string | null = null;
    if (membership?.isActive) {
      membershipSubtitle = joinedLabel ? `Seit ${joinedLabel} Teil der Produktion.` : "Mitgliedschaft aktiv.";
    } else if (membership) {
      membershipSubtitle = joinedLabel && leftLabel
        ? `Von ${joinedLabel} bis ${leftLabel} aktiv.`
        : leftLabel
          ? `Mitgliedschaft beendet am ${leftLabel}.`
          : "Mitgliedschaft archiviert.";
    }

    return (
      <Card className={cn(DASHBOARD_CARD_SURFACE, "relative overflow-hidden")}>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-28 -top-16 h-48 w-48 rounded-full bg-primary/10 opacity-40 blur-3xl dark:bg-primary/20"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 bottom-0 h-44 w-44 rounded-full bg-amber-200/20 opacity-40 blur-3xl dark:bg-amber-500/20"
        />
        <CardHeader className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold">Aktive Produktion</CardTitle>
            <p className="text-sm text-muted-foreground">
              Du arbeitest aktuell in {productionLabel}.
            </p>
          </div>
          <Badge variant="outline" className={statusBadgeClass}>
            {statusBadgeLabel}
          </Badge>
        </CardHeader>
        <CardContent className="relative z-10 space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{productionLabel}</p>
            <p className="text-xs text-muted-foreground">
              {membershipSubtitle ?? "Mitgliedschaft automatisch verwaltet."}
            </p>
          </div>
          {membershipBadges}
          {sharedNote}
          {canAccessProductions ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild size="sm">
                <Link href={`/mitglieder/produktionen/${activeProduction.id}`}>Arbeitsbereich öffnen</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/mitglieder/produktionen">Produktion wechseln</Link>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }, [
    activeProduction,
    activeProductionError,
    activeProductionLoaded,
    activeMembership,
    canAccessProductions,
    otherMemberships,
  ]);



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
    <Fragment>
      <MembersContentLayout width="2xl" spacing="comfortable" gap="lg" />
      <MembersTopbar>
        <MembersTopbarTitle>Mitglieder-Dashboard</MembersTopbarTitle>
        <MembersTopbarStatus>
          <PageHeaderStatus state={connectionMeta.state} icon={connectionMeta.icon}>
            {connectionMeta.label}
          </PageHeaderStatus>
        </MembersTopbarStatus>
      </MembersTopbar>

      <MembersContentHeader>
        <PageHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1.5">
              <PageHeaderTitle>Mitglieder-Dashboard</PageHeaderTitle>
              <PageHeaderDescription>
                Aktuelle Kennzahlen, Aktivitäten und Schnellzugriffe auf einen Blick.
              </PageHeaderDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <PageHeaderStatus state={connectionMeta.state} icon={connectionMeta.icon}>
                {connectionMeta.label}
              </PageHeaderStatus>
              {profileCompletion?.complete ? (
                <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
                  Profil aktualisiert
                </Badge>
              ) : null}
            </div>
          </div>
        </PageHeader>
      </MembersContentHeader>

      <div className="space-y-10 pb-12">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card className={cn(DASHBOARD_CARD_ACCENT, "relative overflow-hidden")}>
            <div
              aria-hidden
              className="pointer-events-none absolute -left-24 -top-24 h-48 w-48 rounded-full bg-primary/20 opacity-60 blur-3xl dark:bg-primary/30"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -right-24 bottom-0 h-44 w-44 rounded-full bg-emerald-300/25 opacity-70 blur-3xl dark:bg-emerald-500/20"
            />
            <CardContent className="relative z-10 space-y-6 p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 text-primary">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Willkommen zurück</p>
                    <h2 className="text-2xl font-semibold tracking-tight">
                      {session?.user?.name || session?.user?.email || "Mitglied"}
                    </h2>
                  </div>
                </div>
                {onlineUsers.length ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-gradient-to-r from-muted/20 via-background/85 to-background px-3 py-1 text-xs text-muted-foreground backdrop-blur">
                    <Users className="h-3.5 w-3.5" />
                    <span>{numberFormatter.format(onlineUsers.length)} online</span>
                  </div>
                ) : null}
              </div>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Halte Produktionen, Proben und Teamkommunikation im Blick. Nutze die Schnellaktionen für den direkten Einstieg.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <div
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
                    connectionBadgeClass,
                  )}
                >
                  {connectionMeta.icon}
                  <span>{connectionMeta.label}</span>
                </div>
              </div>
              {profileReminder ? <div>{profileReminder}</div> : null}
            </CardContent>
          </Card>
          <Card className={cn(DASHBOARD_CARD_SURFACE, "relative overflow-hidden")}>
            <div
              aria-hidden
              className="pointer-events-none absolute -right-24 top-1/2 h-44 w-44 -translate-y-1/2 rounded-full bg-primary/10 opacity-60 blur-3xl dark:bg-primary/20"
            />
            <CardHeader className="relative z-10 space-y-1 p-6 pb-4">
              <CardTitle className="text-base font-semibold">Schnellaktionen</CardTitle>
              <p className="text-sm text-muted-foreground">
                Direkt zu den wichtigsten Bereichen springen.
              </p>
            </CardHeader>
            <CardContent className="relative z-10 p-6 pt-0">
              {quickActions.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {quickActions.map((link) => {
                    const Icon = link.icon;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="group relative flex items-center justify-between gap-3 overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-muted/20 via-background/90 to-background px-3 py-3 text-sm font-medium transition hover:border-primary/45 hover:bg-primary/5"
                      >
                        <span
                          aria-hidden
                          className="pointer-events-none absolute -right-12 -top-12 h-24 w-24 rounded-full bg-primary/10 opacity-0 transition duration-300 group-hover:opacity-80"
                        />
                        <span className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/80 text-muted-foreground transition group-hover:border-primary/45 group-hover:text-primary">
                            <Icon className="h-4 w-4" />
                          </span>
                          {link.label}
                        </span>
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" />
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Keine Schnellaktionen verfügbar.</p>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <Card
              key={metric.key}
              className={cn(
                "rounded-2xl border",
                METRIC_CARD_CLASSES[metric.tone],
              )}
            >
              <CardHeader className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/90">
                      {metric.label}
                    </p>
                    <p className="text-2xl font-semibold tracking-tight">{metric.value}</p>
                  </div>
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl border text-sm",
                      METRIC_ICON_CLASSES[metric.tone],
                    )}
                  >
                    {metric.icon}
                  </div>
                </div>
                {metric.hint ? <p className="text-xs text-muted-foreground">{metric.hint}</p> : null}
              </CardHeader>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="space-y-6">
            {activeProductionCard}
          </div>
          <div className="space-y-6 xl:self-start">
            <Card className={cn("relative overflow-hidden", DASHBOARD_CARD_SURFACE)}>
              <div
                aria-hidden
                className="pointer-events-none absolute -right-24 top-0 h-40 w-40 rounded-full bg-success/15 opacity-40 blur-3xl dark:bg-success/25"
              />
              <CardHeader className="relative z-10 space-y-1 pb-4">
                <CardTitle>Aktive Mitglieder</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Wer ist gerade online? Live-Ansicht aktualisiert automatisch.
                </p>
              </CardHeader>
              <CardContent className="relative z-10 flex flex-col gap-4">
                {onlineList.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-gradient-to-br from-muted/20 via-background/90 to-background p-4 text-sm text-muted-foreground">
                    {onlineLoading ? "Lade Live-Daten …" : "Derzeit ist niemand online."}
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {onlineList.map((user) => (
                      <li
                        key={`${user.id}-${user.joinedAt.getTime()}`}
                        className="flex items-center justify-between rounded-2xl border border-border/50 bg-gradient-to-r from-muted/20 via-background/90 to-background px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-2.5 w-2.5 rounded-full bg-success" />
                          <span className="text-sm font-medium">{user.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatTimeAgo(user.joinedAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className={cn("relative overflow-hidden", DASHBOARD_CARD_SURFACE)}>
              <div
                aria-hidden
                className="pointer-events-none absolute -left-24 top-0 h-40 w-40 rounded-full bg-primary/12 opacity-40 blur-3xl dark:bg-primary/20"
              />
              <CardHeader className="relative z-10 space-y-1 pb-4">
                <CardTitle>Aktivitäten</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Neueste Proben, Zusagen und Benachrichtigungen.
                </p>
              </CardHeader>
              <CardContent className="relative z-10 flex flex-col gap-4">
                {isLoading && recentActivities.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-gradient-to-br from-muted/20 via-background/90 to-background p-4 text-sm text-muted-foreground">
                    Lade Aktivitäten …
                  </div>
                ) : recentActivities.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-gradient-to-br from-muted/20 via-background/90 to-background p-4 text-sm text-muted-foreground">
                    Noch keine Aktivitäten erfasst.
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {recentActivities.map((activity) => (
                      <li
                        key={`${activity.id}-${activity.timestamp.getTime()}`}
                        className="flex items-center gap-3 rounded-2xl border border-border/50 bg-gradient-to-r from-muted/20 via-background/90 to-background px-4 py-3"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-muted/40">
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
        </section>
      </div>
    </Fragment>
  );
}
