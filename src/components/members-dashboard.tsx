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
import { Skeleton } from "@/components/ui/skeleton";
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
  endDate: Date | null;
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
  progress?: number;
  cta?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
};

type DashboardTask = {
  id: string;
  title: string;
  description: string;
  status: "todo" | "done";
  icon: ReactNode;
  progress?: number;
  cta?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
};

const DASHBOARD_CARD_SURFACE =
  "rounded-3xl border border-border/60 bg-gradient-to-br from-background via-background/95 to-background shadow-lg shadow-primary/5 backdrop-blur";

const DAY_IN_MS = 86_400_000;

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

const METRIC_PROGRESS_CLASSES: Record<MetricTone, string> = {
  neutral: "bg-muted/40",
  accent: "bg-primary/10",
  positive: "bg-success/15",
  warning: "bg-warning/15",
  destructive: "bg-destructive/15",
};

const METRIC_PROGRESS_INDICATOR_CLASSES: Record<MetricTone, string> = {
  neutral: "bg-primary",
  accent: "bg-primary",
  positive: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
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
    href: "/mitglieder/kalender",
    label: "Kalender",
    icon: CalendarRange,
    permissionKey: "mitglieder.kalender",
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

  const endDate = parseIsoDate(value.endDate);

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
    endDate,
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
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  const loadOverview = useCallback(
    async ({
      mode = "initial",
      signal,
    }: { mode?: "initial" | "refresh"; signal?: AbortSignal } = {}) => {
      if (signal?.aborted) return;
      if (mode === "initial") {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setActiveProductionError(false);

      try {
        const response = await fetch("/api/dashboard/overview", {
          cache: "no-store",
          signal,
        });
        if (!response.ok) {
          console.error("[Dashboard] Failed to load overview", response.status);
          return;
        }
        const payload = (await response.json()) as OverviewResponse;
        if (signal?.aborted) return;

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
        if (signal?.aborted) return;
        console.error("[Dashboard] Error loading overview", error);
        setActiveProductionError(true);
      } finally {
        if (signal?.aborted) return;
        if (mode === "initial") {
          setIsLoading(false);
        } else {
          setIsRefreshing(false);
        }
        setActiveProductionLoaded(true);
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadOverview({ mode: "initial", signal: controller.signal }).catch((error) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        console.error("[Dashboard] loadOverview failed", error);
      }
    });
    return () => controller.abort();
  }, [loadOverview]);

  const addActivity = useCallback((activity: RecentActivity) => {
    setRecentActivities((prev) => {
      const filtered = prev.filter((entry) => entry.id !== activity.id);
      return [activity, ...filtered].slice(0, 10);
    });
  }, []);

  const handleRefresh = useCallback(() => {
    loadOverview({ mode: "refresh" }).catch((error) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        console.error("[Dashboard] refresh failed", error);
      }
    });
  }, [loadOverview]);

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
    const formatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });
    const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const endDay = finalRehearsalWeek.endDate
      ? new Date(
          finalRehearsalWeek.endDate.getFullYear(),
          finalRehearsalWeek.endDate.getMonth(),
          finalRehearsalWeek.endDate.getDate(),
        )
      : null;
    const formattedStart = formatter.format(startDay);
    const formattedEnd = endDay ? formatter.format(endDay) : null;
    const rangeHint = formattedEnd
      ? `${showLabel} · ${formattedStart} – ${formattedEnd}`
      : `${showLabel} · Start am ${formattedStart}`;
    const effectiveEnd = endDay ?? new Date(startDay.getTime() + 6 * DAY_IN_MS);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffMs = startDay.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / DAY_IN_MS);

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
        hint: rangeHint,
        tone,
      } as const;
    }

    if (diffDays === 0) {
      return {
        label: "Endprobenwoche",
        value: "Heute",
        hint: rangeHint,
        tone: "warning" as const,
      };
    }

    if (effectiveEnd.getTime() >= today.getTime()) {
      return {
        label: "Endprobenwoche",
        value: "Läuft",
        hint: rangeHint,
        tone: "warning" as const,
      };
    }

    return {
      label: "Endprobenwoche",
      value: "Abgeschlossen",
      hint: rangeHint,
      tone: "positive" as const,
    };
  }, [finalRehearsalWeek]);

  const numberFormatter = useMemo(() => new Intl.NumberFormat("de-DE"), []);

  const onlineUpdatedHint = onlineLoading
    ? "Aktualisiert …"
    : `Aktualisiert ${formatTimeAgo(new Date())}`;

  const metrics = useMemo(() => {
    const onlineProgress = stats.totalMembers > 0 ? stats.totalOnline / stats.totalMembers : 0;
    const quickLinksByHref = new Map(availableQuickActions.map((link) => [link.href, link]));

    const items: MetricItem[] = [
      {
        key: "online",
        label: "Online Mitglieder",
        value: numberFormatter.format(stats.totalOnline),
        hint: onlineUpdatedHint,
        icon: <Users className="h-4 w-4" />,
        tone: "positive",
        progress: onlineProgress,
        cta: {
          label: connectionStatus === "connected" ? "Live-Status" : "Neu laden",
          onClick: connectionStatus === "connected" ? undefined : handleRefresh,
          href:
            connectionStatus === "connected"
              ? quickLinksByHref.get("/mitglieder/mitgliederverwaltung")?.href
              : undefined,
        },
      },
      {
        key: "members",
        label: "Mitglieder gesamt",
        value: numberFormatter.format(stats.totalMembers),
        hint: "inkl. Ensemble und Technik",
        icon: <Activity className="h-4 w-4" />,
        tone: "neutral",
        progress: stats.totalMembers > 0 ? 1 : 0,
        cta: quickLinksByHref.get("/mitglieder/mitgliederverwaltung")
          ? {
              label: "Verwalten",
              href: "/mitglieder/mitgliederverwaltung",
            }
          : undefined,
      },
      {
        key: "rehearsals",
        label: "Proben diese Woche",
        value: numberFormatter.format(stats.rehearsalsThisWeek),
        hint: "Termine der laufenden Kalenderwoche",
        icon: <Calendar className="h-4 w-4" />,
        tone: "accent",
        progress: Math.min(stats.rehearsalsThisWeek / 7, 1),
        cta: quickLinksByHref.get("/mitglieder/meine-proben")
          ? {
              label: "Meine Proben",
              href: "/mitglieder/meine-proben",
            }
          : quickLinksByHref.get("/mitglieder/kalender")
              ? {
                  label: "Zum Kalender",
                  href: "/mitglieder/kalender",
                }
              : undefined,
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
        progress:
          typeof finalRehearsalMetric.value === "number"
            ? Math.min(Math.max(1 - Number(finalRehearsalMetric.value) / 14, 0), 1)
            : undefined,
        cta: quickLinksByHref.get("/mitglieder/probenplanung")
          ? {
              label: "Probenplanung",
              href: "/mitglieder/probenplanung",
            }
          : undefined,
      });
    }

    return items;
  }, [
    finalRehearsalMetric,
    connectionStatus,
    handleRefresh,
    availableQuickActions,
    numberFormatter,
    onlineUpdatedHint,
    stats.rehearsalsThisWeek,
    stats.totalMembers,
    stats.totalOnline,
  ]);

  const dashboardTasks = useMemo(() => {
    const items: DashboardTask[] = [];

    if (profileCompletion) {
      const total = Math.max(profileCompletion.total, 1);
      const completed = Math.min(profileCompletion.completed, total);
      const remaining = Math.max(total - completed, 0);
      items.push({
        id: "profile",
        title: profileCompletion.complete ? "Profil gepflegt" : "Profil vervollständigen",
        description: profileCompletion.complete
          ? "Alle Pflichtangaben wurden bestätigt."
          : `Noch ${remaining} von ${total} Angaben offen.`,
        status: profileCompletion.complete ? "done" : "todo",
        icon: profileCompletion.complete ? <CheckCircle2 className="h-4 w-4" /> : <CalendarRange className="h-4 w-4" />,
        progress: completed / total,
        cta: {
          label: profileCompletion.complete ? "Profil ansehen" : "Jetzt ergänzen",
          href: "/mitglieder/profil",
        },
      });
    }

    if (stats.unreadNotifications > 0) {
      items.push({
        id: "notifications",
        title: "Ungelesene Benachrichtigungen",
        description: `${numberFormatter.format(stats.unreadNotifications)} Nachricht(en) warten auf dich.`,
        status: "todo",
        icon: <Bell className="h-4 w-4" />,
        progress: 0,
        cta: {
          label: "Aktualisieren",
          onClick: handleRefresh,
        },
      });
    }

    if (finalRehearsalMetric) {
      const isNumeric = typeof finalRehearsalMetric.value === "number";
      const progress = isNumeric ? Math.min(Math.max(1 - Number(finalRehearsalMetric.value) / 14, 0), 1) : undefined;
      items.push({
        id: "final-rehearsal",
        title: finalRehearsalMetric.label,
        description: finalRehearsalMetric.hint ?? "Bleib bei Endproben auf dem Laufenden.",
        status: finalRehearsalMetric.tone === "positive" ? "done" : "todo",
        icon: <Sparkles className="h-4 w-4" />,
        progress,
        cta: quickActions.find((action) => action.href === "/mitglieder/probenplanung")
          ? {
              label: "Probenplanung",
              href: "/mitglieder/probenplanung",
            }
          : quickActions.find((action) => action.href === "/mitglieder/meine-proben")
              ? {
                  label: "Meine Proben",
                  href: "/mitglieder/meine-proben",
                }
              : undefined,
      });
    }

    return items;
  }, [
    finalRehearsalMetric,
    handleRefresh,
    numberFormatter,
    profileCompletion,
    quickActions,
    stats.unreadNotifications,
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

  const heroName = session.user.name || session.user.email || "Mitglied";
  const formattedOnlineCount = numberFormatter.format(stats.totalOnline);

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
        <div className="hidden lg:block">
          <PageHeader>
            <div className="flex items-end justify-between gap-4">
              <div className="space-y-1.5">
                <PageHeaderTitle>Mitglieder-Dashboard</PageHeaderTitle>
                <PageHeaderDescription>
                  Aktuelle Kennzahlen, Aktivitäten und Schnellzugriffe auf einen Blick.
                </PageHeaderDescription>
              </div>
              <div className="flex items-center gap-3">
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
        </div>
      </MembersContentHeader>

      <div className="space-y-10 pb-12">
        <section className="space-y-6">
          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 lg:mx-0 lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-6 lg:overflow-visible lg:pb-0">
            <HomeHeroCard
              className="min-w-[calc(100vw-2.5rem)] snap-start lg:min-w-0"
              name={heroName}
              connectionMeta={connectionMeta}
              connectionBadgeClass={connectionBadgeClass}
              quickActions={quickActions}
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
              isLoading={isLoading}
              onlineCountLabel={formattedOnlineCount}
              onlineUpdatedHint={onlineUpdatedHint}
            />
            <TaskListCard
              className="min-w-[calc(100vw-2.5rem)] snap-start lg:min-w-0"
              tasks={dashboardTasks}
              isLoading={isLoading}
              isRefreshing={isRefreshing}
              onRefresh={handleRefresh}
            />
          </div>
        </section>

        <section>
          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:pb-0 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricCard key={metric.key} metric={metric} />
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-6">
            <ProductionSwitcherCard
              activeProduction={activeProduction}
              activeMembership={activeMembership}
              otherMemberships={otherMemberships}
              canAccessProductions={canAccessProductions}
              isLoaded={activeProductionLoaded}
              hasError={activeProductionError}
              onRetry={handleRefresh}
              isRefreshing={isRefreshing}
              connectionMeta={connectionMeta}
            />
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

            <TimelineCard
              activities={recentActivities}
              isLoading={isLoading && recentActivities.length === 0}
              isRefreshing={isRefreshing}
              onRefresh={handleRefresh}
              connectionMeta={connectionMeta}
              getIcon={getActivityIcon}
              formatTimestamp={formatTimeAgo}
            />
          </div>
        </section>
      </div>
    </Fragment>
  );
}

interface MetricCardProps {
  metric: MetricItem;
  className?: string;
}

function MetricCard({ metric, className }: MetricCardProps) {
  const clampedProgress =
    typeof metric.progress === "number"
      ? Math.min(Math.max(metric.progress, 0), 1)
      : undefined;
  const progressPercent =
    typeof clampedProgress === "number"
      ? Math.round(clampedProgress * 100)
      : undefined;
  const cta = metric.cta;

  const actionButton = cta
    ? cta.href
      ? (
          <Button
            size="xs"
            variant="primary"
            className="rounded-full shadow-[0_14px_34px_-18px_rgba(15,23,42,0.6)]"
            asChild
          >
            <Link href={cta.href}>{cta.label}</Link>
          </Button>
        )
      : cta.onClick
        ? (
            <Button
              size="xs"
              variant="primary"
              className="rounded-full shadow-[0_14px_34px_-18px_rgba(15,23,42,0.6)]"
              onClick={cta.onClick}
            >
              {cta.label}
            </Button>
          )
        : null
    : null;

  return (
    <Card
      className={cn(
        "min-w-[calc(100vw-2.5rem)] snap-start rounded-2xl border sm:min-w-0",
        METRIC_CARD_CLASSES[metric.tone],
        className,
      )}
    >
      <CardHeader className="space-y-4 p-5 pb-4">
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
      {(typeof clampedProgress === "number" || actionButton) && (
        <CardContent className="flex flex-col gap-3 p-5 pt-0">
          {typeof clampedProgress === "number" ? (
            <div className="space-y-1.5">
              <div
                className={cn(
                  "h-1.5 w-full overflow-hidden rounded-full",
                  METRIC_PROGRESS_CLASSES[metric.tone],
                )}
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-[width]",
                    METRIC_PROGRESS_INDICATOR_CLASSES[metric.tone],
                  )}
                  style={{ width: `${progressPercent}%` }}
                  aria-hidden
                />
              </div>
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                {progressPercent}% Fortschritt
              </span>
            </div>
          ) : null}
          {actionButton ? <div className="pt-1">{actionButton}</div> : null}
        </CardContent>
      )}
    </Card>
  );
}

interface HomeHeroCardProps {
  className?: string;
  name: string;
  connectionMeta: { state: "online" | "offline" | "warning" | "error"; icon: ReactNode; label: string };
  connectionBadgeClass: string;
  quickActions: QuickActionLink[];
  onRefresh: () => void;
  isRefreshing: boolean;
  isLoading: boolean;
  onlineCountLabel: string;
  onlineUpdatedHint: string;
}

function HomeHeroCard({
  className,
  name,
  connectionMeta,
  connectionBadgeClass,
  quickActions,
  onRefresh,
  isRefreshing,
  isLoading,
  onlineCountLabel,
  onlineUpdatedHint,
}: HomeHeroCardProps) {
  const visibleActions = quickActions.slice(0, 4);

  return (
    <Card className={cn(DASHBOARD_CARD_ACCENT, "relative overflow-hidden", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 h-48 w-48 rounded-full bg-primary/20 opacity-60 blur-3xl dark:bg-primary/30"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 bottom-0 h-44 w-44 rounded-full bg-emerald-300/25 opacity-70 blur-3xl dark:bg-emerald-500/20"
      />
      <CardContent className="relative z-10 flex h-full flex-col gap-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Willkommen zurück</p>
            {isLoading ? (
              <Skeleton className="h-7 w-40" />
            ) : (
              <h2 className="text-2xl font-semibold tracking-tight">{name}</h2>
            )}
            <p className="text-xs text-muted-foreground/80">{onlineUpdatedHint}</p>
          </div>
          <div className="flex flex-col items-end gap-2 text-xs">
            <div
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 font-medium",
                connectionBadgeClass,
              )}
            >
              {connectionMeta.icon}
              <span>{connectionMeta.label}</span>
            </div>
            <Button
              size="xs"
              variant="secondary"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="rounded-full shadow-[0_14px_34px_-18px_rgba(15,23,42,0.45)]"
            >
              {isRefreshing ? "Aktualisiert …" : "Neu laden"}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
            <Users className="mr-1 h-3.5 w-3.5" />
            {onlineCountLabel} online
          </Badge>
          <span className="text-xs text-muted-foreground/80">
            Tipp: Ziehe nach unten oder tippe auf „Neu laden“ für mobile Aktualisierung.
          </span>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
              Schnellstart
            </p>
            <span className="text-[11px] text-muted-foreground/70">
              {visibleActions.length ? "Wische für mehr" : "Keine Aktionen verfügbar"}
            </span>
          </div>
          {isLoading ? (
            <div className="-mx-1 flex snap-x gap-3 overflow-x-auto pb-1">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={`hero-skeleton-${index}`} className="h-9 w-28 rounded-full" />
              ))}
            </div>
          ) : visibleActions.length ? (
            <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
              {visibleActions.map((action) => {
                const ActionIcon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="snap-start rounded-full border border-border/50 bg-background/90 px-4 py-2 text-xs font-semibold text-foreground shadow-[0_12px_24px_-16px_rgba(15,23,42,0.5)] transition hover:border-primary/60 hover:bg-primary/5"
                  >
                    <span className="flex items-center gap-2">
                      <ActionIcon className="h-4 w-4" />
                      {action.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="rounded-full border border-dashed border-border/60 bg-background/80 px-4 py-2 text-xs text-muted-foreground">
              Keine Schnellaktionen verfügbar.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface TaskListCardProps {
  className?: string;
  tasks: DashboardTask[];
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
}

function TaskListCard({ className, tasks, isLoading, isRefreshing, onRefresh }: TaskListCardProps) {
  const hasTasks = tasks.length > 0;

  return (
    <Card className={cn(DASHBOARD_CARD_SURFACE, "relative overflow-hidden", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-0 h-44 w-44 rounded-full bg-warning/15 opacity-40 blur-3xl dark:bg-warning/20"
      />
      <CardHeader className="relative z-10 flex flex-row items-center justify-between gap-3 p-6 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">Aufgabenliste</CardTitle>
          <p className="text-sm text-muted-foreground">
            Bleib auf dem Laufenden und erledige offene Schritte.
          </p>
        </div>
        <Button
          size="xs"
          variant="secondary"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="rounded-full shadow-[0_14px_34px_-18px_rgba(15,23,42,0.45)]"
        >
          {isRefreshing ? "Aktualisiert …" : "Neu laden"}
        </Button>
      </CardHeader>
      <CardContent className="relative z-10 flex flex-col gap-4 p-6 pt-0">
        {isLoading && !hasTasks ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={`task-skeleton-${index}`} className="h-14 w-full rounded-2xl" />
            ))}
          </div>
        ) : null}

        {!isLoading && !hasTasks ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-gradient-to-br from-muted/20 via-background/90 to-background p-4 text-sm text-muted-foreground">
            Alles erledigt! Du bist startklar.
          </div>
        ) : null}

        {hasTasks ? (
          <ul className="space-y-3">
            {tasks.map((task) => {
              const progress =
                typeof task.progress === "number"
                  ? Math.min(Math.max(task.progress, 0), 1)
                  : undefined;
              const percentage =
                typeof progress === "number"
                  ? Math.round(progress * 100)
                  : undefined;

              return (
                <li
                  key={task.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/80 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-muted/40 text-muted-foreground">
                        {task.icon}
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">{task.title}</p>
                        <p className="text-xs text-muted-foreground">{task.description}</p>
                      </div>
                    </div>
                    {task.status === "done" ? (
                      <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
                        Erledigt
                      </Badge>
                    ) : null}
                  </div>
                  {typeof progress === "number" ? (
                    <div className="space-y-1.5">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
                        <div
                          className="h-full rounded-full bg-primary transition-[width]"
                          style={{ width: `${percentage}%` }}
                          aria-hidden
                        />
                      </div>
                      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                        {percentage}% abgeschlossen
                      </span>
                    </div>
                  ) : null}
                  {task.cta ? (
                    <div className="pt-1">
                      {task.cta.href ? (
                        <Button
                          size="xs"
                          variant="secondary"
                          className="rounded-full shadow-[0_14px_34px_-18px_rgba(15,23,42,0.45)]"
                          asChild
                        >
                          <Link href={task.cta.href}>{task.cta.label}</Link>
                        </Button>
                      ) : task.cta.onClick ? (
                        <Button
                          size="xs"
                          variant="secondary"
                          className="rounded-full shadow-[0_14px_34px_-18px_rgba(15,23,42,0.45)]"
                          onClick={task.cta.onClick}
                        >
                          {task.cta.label}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

interface TimelineCardProps {
  activities: RecentActivity[];
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  connectionMeta: { state: "online" | "offline" | "warning" | "error"; icon: ReactNode; label: string };
  getIcon: (type: RecentActivity["type"]) => ReactNode;
  formatTimestamp: (date: Date) => string;
  className?: string;
}

function TimelineCard({
  activities,
  isLoading,
  isRefreshing,
  onRefresh,
  connectionMeta,
  getIcon,
  formatTimestamp,
  className,
}: TimelineCardProps) {
  return (
    <Card className={cn("relative overflow-hidden", DASHBOARD_CARD_SURFACE, className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-0 h-40 w-40 rounded-full bg-primary/12 opacity-40 blur-3xl dark:bg-primary/20"
      />
      <CardHeader className="relative z-10 flex flex-row items-center justify-between gap-3 pb-4">
        <div className="space-y-1">
          <CardTitle>Aktivitäten</CardTitle>
          <p className="text-sm text-muted-foreground">
            Live-Updates aus Proben, Zusagen und Benachrichtigungen.
          </p>
        </div>
        <Button
          size="xs"
          variant="secondary"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="rounded-full shadow-[0_14px_34px_-18px_rgba(15,23,42,0.45)]"
        >
          {isRefreshing ? "Aktualisiert …" : "Neu laden"}
        </Button>
      </CardHeader>
      <CardContent className="relative z-10 flex flex-col gap-4 p-6 pt-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground/80">
          {connectionMeta.icon}
          <span>{connectionMeta.label}</span>
        </div>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={`timeline-skeleton-${index}`} className="h-14 w-full rounded-2xl" />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-gradient-to-br from-muted/20 via-background/90 to-background p-4 text-sm text-muted-foreground">
            Noch keine Aktivitäten erfasst.
          </div>
        ) : (
          <ul className="space-y-3">
            {activities.map((activity) => (
              <li
                key={`${activity.id}-${activity.timestamp.getTime()}`}
                className="flex items-center gap-3 rounded-2xl border border-border/50 bg-gradient-to-r from-muted/20 via-background/90 to-background px-4 py-3"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-muted/40">
                  {getIcon(activity.type)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{activity.message}</p>
                  <p className="text-xs text-muted-foreground">{formatTimestamp(activity.timestamp)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

interface ProductionSwitcherCardProps {
  activeProduction: ActiveProductionOverview | null;
  activeMembership: ProductionMembershipSummary | null;
  otherMemberships: ProductionMembershipSummary[];
  canAccessProductions: boolean;
  isLoaded: boolean;
  hasError: boolean;
  onRetry: () => void;
  isRefreshing: boolean;
  connectionMeta: { state: "online" | "offline" | "warning" | "error"; icon: ReactNode; label: string };
}

function ProductionSwitcherCard({
  activeProduction,
  activeMembership,
  otherMemberships,
  canAccessProductions,
  isLoaded,
  hasError,
  onRetry,
  isRefreshing,
  connectionMeta,
}: ProductionSwitcherCardProps) {
  if (!isLoaded) {
    return (
      <Card className="rounded-3xl border border-dashed border-border/60 bg-card p-6">
        <div className="space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-full" />
        </div>
      </Card>
    );
  }

  if (hasError) {
    return (
      <Card className="rounded-3xl border border-destructive/40 bg-destructive/10 text-destructive">
        <CardContent className="space-y-3 p-6">
          <p className="text-sm font-semibold">Aktive Produktion konnte nicht geladen werden.</p>
          <p className="text-xs text-destructive/80">
            Bitte versuche es erneut. Bei anhaltenden Problemen kontaktiere die Produktionsleitung.
          </p>
          <Button
            size="xs"
            variant="secondary"
            onClick={onRetry}
            className="rounded-full shadow-[0_14px_34px_-18px_rgba(127,29,29,0.45)]"
          >
            Erneut laden
          </Button>
        </CardContent>
      </Card>
    );
  }

  const membershipBadges = otherMemberships.slice(0, 4);

  const statusBadgeLabel = activeMembership?.isActive === false ? "Archiviert" : "Aktiv";
  const statusBadgeClass = activeMembership?.isActive === false
    ? "border-border/60 text-muted-foreground"
    : "border-primary/40 bg-primary/10 text-primary";

  const joinedLabel = formatDateLocalized(activeMembership?.joinedAt ?? null);
  const leftLabel = formatDateLocalized(activeMembership?.leftAt ?? null);

  let membershipSubtitle: string | null = null;
  if (activeMembership?.isActive) {
    membershipSubtitle = joinedLabel ? `Seit ${joinedLabel} Teil der Produktion.` : "Mitgliedschaft aktiv.";
  } else if (activeMembership) {
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
          <CardTitle className="text-lg font-semibold">
            {activeProduction ? "Aktive Produktion" : "Keine aktive Produktion ausgewählt"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {activeProduction
              ? `Du arbeitest aktuell in ${formatProductionName(activeProduction)}.`
              : "Wähle eine Produktion, um Rollen und Planungen einzusehen."}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant="outline" className={statusBadgeClass}>
            {statusBadgeLabel}
          </Badge>
          <span className="text-[11px] text-muted-foreground/80">
            {connectionMeta.label}
          </span>
        </div>
      </CardHeader>
      <CardContent className="relative z-10 space-y-4">
        {activeProduction ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{formatProductionName(activeProduction)}</p>
            <p className="text-xs text-muted-foreground">
              {membershipSubtitle ?? "Mitgliedschaft wird automatisch verwaltet."}
            </p>
          </div>
        ) : null}

        {membershipBadges.length ? (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
              Weitere Produktionen
            </p>
            <div className="flex flex-wrap gap-2">
            {membershipBadges.map((membership) => {
              const membershipLeftLabel = formatDateLocalized(membership.leftAt);
              return (
                <Badge
                  key={`membership-${membership.showId}`}
                  variant="outline"
                  className={cn(
                    "border-border/60 bg-card text-foreground",
                    membership.isActive && "border-primary/40 bg-primary/10 text-primary",
                  )}
                >
                  <span className="font-medium">{formatProductionName(membership)}</span>
                  <span className="ml-1 text-[11px] text-muted-foreground">
                    {membership.isActive ? "• aktiv" : membershipLeftLabel ? `• bis ${membershipLeftLabel}` : "• archiviert"}
                  </span>
                </Badge>
              );
            })}
            </div>
            {otherMemberships.length > membershipBadges.length ? (
              <p className="text-[11px] text-muted-foreground">
                + {otherMemberships.length - membershipBadges.length} weitere im Archiv
              </p>
            ) : null}
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Profilangaben gelten produktonsübergreifend und bleiben für kommende Produktionen gespeichert.
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          {canAccessProductions && activeProduction ? (
            <Button
              asChild
              size="xs"
              className="rounded-full shadow-[0_14px_34px_-18px_rgba(15,23,42,0.45)]"
              disabled={isRefreshing}
            >
              <Link href={`/mitglieder/produktionen/${activeProduction.id}`}>Arbeitsbereich öffnen</Link>
            </Button>
          ) : null}
          {canAccessProductions ? (
            <Button
              asChild
              size="xs"
              variant="secondary"
              className="rounded-full shadow-[0_14px_34px_-18px_rgba(15,23,42,0.45)]"
              disabled={isRefreshing}
            >
              <Link href="/mitglieder/produktionen">
                {activeProduction ? "Produktion wechseln" : "Produktion auswählen"}
              </Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
