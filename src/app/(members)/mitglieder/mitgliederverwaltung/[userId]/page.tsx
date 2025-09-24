import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CalendarClock,
  CalendarDays,
  History,
  ListChecks,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import type { AttendanceStatus, OnboardingFocus, PhotoConsentStatus, Prisma, TaskStatus } from "@prisma/client";

import { PageHeader } from "@/components/members/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/user-avatar";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { ROLE_BADGE_VARIANTS, ROLE_LABELS, sortRoles, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { formatRelativeFromNow } from "@/lib/datetime";
import { getUserDisplayName } from "@/lib/names";
import { MemberTestNotificationCard } from "@/components/members/member-test-notification-card";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";

const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "long" });
const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });
const numberFormatter = new Intl.NumberFormat("de-DE");
const percentFormatter = new Intl.NumberFormat("de-DE", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});
const monthFormatter = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" });

const ATTENDANCE_STATUS_ORDER: AttendanceStatus[] = ["yes", "maybe", "no", "emergency"];

// Attendance UI labels and styles
const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  yes: "Zusage",
  maybe: "Unentschieden",
  no: "Absage",
  emergency: "Notfall",
};

const ATTENDANCE_STATUS_BADGE_CLASSES: Record<AttendanceStatus, string> = {
  yes: "border-emerald-200 bg-emerald-500/10 text-emerald-700",
  maybe: "border-amber-200 bg-amber-500/10 text-amber-700",
  no: "border-rose-200 bg-rose-500/10 text-rose-700",
  emergency: "border-red-200 bg-red-500/10 text-red-700",
};

const ATTENDANCE_STATUS_DOT_CLASSES: Record<AttendanceStatus, string> = {
  yes: "bg-emerald-500",
  maybe: "bg-amber-500",
  no: "bg-rose-500",
  emergency: "bg-red-500",
};

const ATTENDANCE_STATUS_SEGMENT_CLASSES: Record<AttendanceStatus, string> = {
  yes: "bg-emerald-500/70",
  maybe: "bg-amber-500/70",
  no: "bg-rose-500/70",
  emergency: "bg-red-500/70",
};

const DEFAULT_BADGE_CLASS = "border-border/60 bg-muted/40 text-muted-foreground";
const DEFAULT_DOT_CLASS = "bg-muted-foreground";
const DEFAULT_SEGMENT_CLASS = "bg-muted/70";

// Tasks UI labels
const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "Offen",
  doing: "In Arbeit",
  done: "Erledigt",
};

// Onboarding focus labels
const ONBOARDING_FOCUS_LABELS: Record<OnboardingFocus, string> = {
  acting: "Schauspiel",
  tech: "Gewerke",
  both: "Schauspiel & Gewerke",
};

// Photo consent types and labels
type PhotoConsentSelection = {
  status: PhotoConsentStatus;
  consentGiven: boolean;
  updatedAt: Date | null;
  approvedAt: Date | null;
};

type PhotoConsentInfo = {
  label: string;
  description: string;
  className: string;
  updatedAt: Date | null;
};

const PHOTO_STATUS_LABELS: Record<PhotoConsentStatus, string> = {
  pending: "In Prüfung",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
};

const PHOTO_STATUS_DESCRIPTIONS: Record<PhotoConsentStatus, string> = {
  pending: "Die Einverständniserklärung wird aktuell geprüft.",
  approved: "Foto-/Videofreigabe ist erteilt.",
  rejected: "Die Einverständniserklärung wurde abgelehnt.",
};

const PHOTO_STATUS_CLASSES: Record<PhotoConsentStatus, string> = {
  pending: "border-warning/45 bg-warning/10 text-warning",
  approved: "border-success/45 bg-success/10 text-success",
  rejected: "border-destructive/45 bg-destructive/10 text-destructive",
};

function formatDate(value: Date | null | undefined) {
  if (!value) return "—";
  return dateFormatter.format(value);
}

function formatDateTime(value: Date | null | undefined) {
  if (!value) return null;
  return dateTimeFormatter.format(value);
}

function resolvePhotoConsent(consent: PhotoConsentSelection | null): PhotoConsentInfo {
  if (!consent) {
    return {
      label: "Noch nicht eingereicht",
      description: "Für dieses Mitglied liegt keine Fotoeinverständnis vor.",
      className: "border-border/70 bg-muted/40 text-muted-foreground",
      updatedAt: null,
    };
  }

  if (!consent.consentGiven) {
    return {
      label: "Keine Freigabe erteilt",
      description: "Die Veröffentlichung von Foto- und Videoaufnahmen ist untersagt.",
      className: "border-destructive/45 bg-destructive/10 text-destructive",
      updatedAt: consent.updatedAt ?? null,
    };
  }

  const status = consent.status;
  const label = PHOTO_STATUS_LABELS[status] ?? "Status unbekannt";
  const description = PHOTO_STATUS_DESCRIPTIONS[status] ?? "Status konnte nicht bestimmt werden.";
  const className = PHOTO_STATUS_CLASSES[status] ?? "border-border/70 bg-muted/40 text-muted-foreground";
  const updatedAt = consent.approvedAt ?? consent.updatedAt ?? null;

  return {
    label,
    description,
    className,
    updatedAt,
  };
}

function getAttendanceStatusLabel(status: AttendanceStatus | null | undefined) {
  if (!status) return "Kein Status";
  return ATTENDANCE_STATUS_LABELS[status] ?? "Unbekannt";
}

function describeAttendanceChange(
  previous: AttendanceStatus | null | undefined,
  next: AttendanceStatus | null | undefined,
) {
  const previousLabel = previous ? getAttendanceStatusLabel(previous) : null;
  const nextLabel = next ? getAttendanceStatusLabel(next) : null;

  if (previousLabel && nextLabel) {
    return `Status von ${previousLabel} zu ${nextLabel} aktualisiert`;
  }
  if (nextLabel) {
    return `Status auf ${nextLabel} gesetzt`;
  }
  if (previousLabel) {
    return `Status ${previousLabel} entfernt`;
  }
  return "Status aktualisiert";
}

function formatRelativeTime(value: Date | null | undefined) {
  if (!value) return null;
  return formatRelativeFromNow(value);
}

type PageProps = { params: Promise<{ userId: string | string[] }> };

type ActivityStatCardProps = {
  label: string;
  value: string;
  hint?: string | null;
  icon?: ReactNode;
};

function ActivityStatCard({ label, value, hint, icon }: ActivityStatCardProps) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/70 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
          {hint ? <div className="mt-2 text-xs text-muted-foreground">{hint}</div> : null}
        </div>
        {icon ? <div className="text-muted-foreground/80">{icon}</div> : null}
      </div>
    </div>
  );
}

function sortByDueDateAscending(
  a: { dueAt: Date | null | undefined },
  b: { dueAt: Date | null | undefined },
) {
  const aTime = a.dueAt ? a.dueAt.getTime() : Number.POSITIVE_INFINITY;
  const bTime = b.dueAt ? b.dueAt.getTime() : Number.POSITIVE_INFINITY;
  return aTime - bTime;
}

const memberSelect = {
  id: true,
  firstName: true,
  lastName: true,
  name: true,
  email: true,
  role: true,
  roles: { select: { role: true } },
  appRoles: {
    select: {
      role: { select: { id: true, name: true, systemRole: true, isSystem: true } },
    },
  },
  avatarSource: true,
  avatarImageUpdatedAt: true,
  createdAt: true,
  dateOfBirth: true,
  deactivatedAt: true,
  onboardingProfile: {
    select: {
      memberSinceYear: true,
      focus: true,
      background: true,
      notes: true,
    },
  },
  interests: {
    select: {
      interest: { select: { id: true, name: true } },
    },
  },
  photoConsent: {
    select: {
      status: true,
      consentGiven: true,
      updatedAt: true,
      approvedAt: true,
    },
  },
} satisfies Prisma.UserSelect;

export default async function MemberProfileAdminPage({ params }: PageProps) {
  const session = await requireAuth();
  const [allowed, canSendTestNotifications] = await Promise.all([
    hasPermission(session.user, "mitglieder.rollenverwaltung"),
    hasPermission(session.user, "mitglieder.notifications.test"),
  ]);
  if (!allowed) {
    return <div className="text-sm text-red-600">Kein Zugriff auf die Mitgliederprofile.</div>;
  }

  const resolvedParams = await params;
  const userIdParam = resolvedParams?.userId;
  const userId = Array.isArray(userIdParam) ? userIdParam[0] : userIdParam;
  if (!userId) {
    notFound();
  }

  const decodedId = decodeURIComponent(userId);

  const member = await prisma.user.findUnique({
    where: { id: decodedId },
    select: memberSelect,
  });

  if (!member) {
    notFound();
  }

  const now = new Date();
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const [attendanceRecordsRaw, attendanceLogsRaw, departmentTasks] = await Promise.all([
    prisma.rehearsalAttendance.findMany({
      where: {
        userId: decodedId,
        rehearsal: { start: { gte: oneYearAgo }, status: { not: "DRAFT" } },
      },
      select: {
        id: true,
        status: true,
        rehearsal: {
          select: {
            id: true,
            title: true,
            start: true,
            end: true,
            location: true,
            status: true,
          },
        },
      },
    }),
    prisma.rehearsalAttendanceLog.findMany({
      where: { userId: decodedId },
      orderBy: { changedAt: "desc" },
      take: 40,
      select: {
        id: true,
        previous: true,
        next: true,
        comment: true,
        changedAt: true,
        changedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            email: true,
          },
        },
        rehearsal: {
          select: {
            id: true,
            title: true,
            start: true,
            location: true,
          },
        },
      },
    }),
    prisma.departmentTask.findMany({
      where: { assigneeId: decodedId },
      select: {
        id: true,
        title: true,
        status: true,
        dueAt: true,
        department: {
          select: { name: true },
        },
      },
    }),
  ]);

  type MonthlyBucket = Record<AttendanceStatus, number> & { total: number };

  const attendanceStatusCounts: Record<AttendanceStatus, number> = {
    yes: 0,
    no: 0,
    maybe: 0,
    emergency: 0,
  };
  const monthlyBuckets = new Map<string, MonthlyBucket>();
  let upcomingTotal = 0;
  let upcomingConfirmed = 0;
  let upcomingDeclined = 0;

  for (const entry of attendanceRecordsRaw) {
    const status = entry.status as AttendanceStatus;
    const rehearsal = entry.rehearsal;
    attendanceStatusCounts[status] += 1;

    if (rehearsal?.start) {
      const start = rehearsal.start;
      const monthKey = `${start.getFullYear()}-${start.getMonth()}`;
      let bucket = monthlyBuckets.get(monthKey);
      if (!bucket) {
        bucket = { yes: 0, no: 0, maybe: 0, emergency: 0, total: 0 };
        monthlyBuckets.set(monthKey, bucket);
      }
      bucket[status] += 1;
      bucket.total += 1;

      if (start >= now) {
        upcomingTotal += 1;
        if (status === "yes") {
          upcomingConfirmed += 1;
        } else if (status === "no" || status === "emergency") {
          upcomingDeclined += 1;
        }
      }
    }
  }

  const upcomingPending = Math.max(upcomingTotal - upcomingConfirmed - upcomingDeclined, 0);
  const totalResponses = ATTENDANCE_STATUS_ORDER.reduce(
    (acc, key) => acc + attendanceStatusCounts[key],
    0,
  );
  const totalResponsesLabel = numberFormatter.format(totalResponses);
  const acceptanceRate = totalResponses > 0 ? attendanceStatusCounts.yes / totalResponses : 0;
  const acceptanceRateLabel = totalResponses > 0 ? percentFormatter.format(acceptanceRate) : "—";

  type MonthlyStat = {
    key: string;
    label: string;
    total: number;
  } & Record<AttendanceStatus, number>;

  const monthRange = 6;
  const monthlyStats: MonthlyStat[] = [];

  for (let offset = monthRange - 1; offset >= 0; offset -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const monthKey = `${monthDate.getFullYear()}-${monthDate.getMonth()}`;
    const bucket =
      monthlyBuckets.get(monthKey) ?? {
        yes: 0,
        no: 0,
        maybe: 0,
        emergency: 0,
        total: 0,
      };
    monthlyStats.push({
      key: monthKey,
      label: monthFormatter.format(monthDate),
      total: bucket.total,
      yes: bucket.yes,
      no: bucket.no,
      maybe: bucket.maybe,
      emergency: bucket.emergency,
    });
  }

  const hasMonthlyData = monthlyStats.some((month) => month.total > 0);

  const activityEntries = attendanceLogsRaw.map((log) => {
    const nextStatus = (log.next ?? null) as AttendanceStatus | null;
    const previousStatus = (log.previous ?? null) as AttendanceStatus | null;
    const changedByName = log.changedBy
      ? getUserDisplayName(
          {
            firstName: log.changedBy.firstName,
            lastName: log.changedBy.lastName,
            name: log.changedBy.name,
            email: log.changedBy.email,
          },
          "System",
        )
      : "System";
    const rehearsalTitle = log.rehearsal?.title?.trim() || "Probe";
    const rehearsalDateLabel = log.rehearsal?.start ? formatDateTime(log.rehearsal.start) : null;

    return {
      id: log.id,
      description: describeAttendanceChange(previousStatus, nextStatus),
      comment: log.comment?.trim() ?? null,
      status: nextStatus,
      statusLabel: getAttendanceStatusLabel(nextStatus),
      badgeClass: nextStatus ? ATTENDANCE_STATUS_BADGE_CLASSES[nextStatus] : DEFAULT_BADGE_CLASS,
      dotClass: nextStatus ? ATTENDANCE_STATUS_DOT_CLASSES[nextStatus] : DEFAULT_DOT_CLASS,
      changedAt: log.changedAt,
      changedAtLabel: formatDateTime(log.changedAt) ?? dateTimeFormatter.format(log.changedAt),
      changedAtRelative: formatRelativeTime(log.changedAt),
      changedBy: changedByName,
      rehearsalTitle,
      rehearsalDateLabel,
    };
  });

  const lastActivityAt = activityEntries[0]?.changedAt ?? null;
  const lastActivityRelative = formatRelativeTime(lastActivityAt);
  const lastActivityAbsolute = lastActivityAt ? formatDateTime(lastActivityAt) : null;

  const taskStatusCounts: Record<TaskStatus, number> = {
    todo: 0,
    doing: 0,
    done: 0,
  };
  const openTasks: typeof departmentTasks = [];
  const overdueTasks: typeof departmentTasks = [];
  const dueSoonTasks: typeof departmentTasks = [];
  const dueSoonThreshold = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  for (const task of departmentTasks) {
    const status = task.status as TaskStatus;
    taskStatusCounts[status] += 1;
    if (status !== "done") {
      openTasks.push(task);
      if (task.dueAt) {
        if (task.dueAt < now) {
          overdueTasks.push(task);
        } else if (task.dueAt <= dueSoonThreshold) {
          dueSoonTasks.push(task);
        }
      }
    }
  }

  const openTaskCount = openTasks.length;
  const completedTaskCount = taskStatusCounts.done;
  const overdueCount = overdueTasks.length;
  const dueSoonCount = dueSoonTasks.length;

  const overdueSorted = overdueTasks.slice().sort(sortByDueDateAscending);
  const dueSoonSorted = dueSoonTasks
    .filter((task) => !overdueTasks.some((overdue) => overdue.id === task.id))
    .slice()
    .sort(sortByDueDateAscending);

  const prioritizedTasks = [...overdueSorted, ...dueSoonSorted].slice(0, 5);

  const prioritizedTaskEntries = prioritizedTasks.map((task) => ({
    id: task.id,
    title: task.title?.trim() || "Unbenannte Aufgabe",
    dueAt: task.dueAt ?? null,
    dueLabel: task.dueAt ? formatDate(task.dueAt) : "Kein Fälligkeitsdatum",
    dueRelative: formatRelativeTime(task.dueAt),
    department: task.department?.name?.trim() ?? null,
    status: task.status as TaskStatus,
  }));

  const prioritizedTaskIds = new Set(prioritizedTaskEntries.map((task) => task.id));
  const otherOpenTaskCount = openTasks.filter((task) => !prioritizedTaskIds.has(task.id)).length;

  const responsesHintParts: string[] = [];
  if (attendanceStatusCounts.yes > 0) {
    responsesHintParts.push(`${numberFormatter.format(attendanceStatusCounts.yes)} Zusagen`);
  }
  if (attendanceStatusCounts.maybe > 0) {
    responsesHintParts.push(`${numberFormatter.format(attendanceStatusCounts.maybe)} Unentschieden`);
  }
  const declines = attendanceStatusCounts.no + attendanceStatusCounts.emergency;
  if (declines > 0) {
    responsesHintParts.push(`${numberFormatter.format(declines)} Absagen/Notfälle`);
  }
  const responsesHint = responsesHintParts.length
    ? responsesHintParts.join(" · ")
    : "Noch keine Rückmeldungen im Zeitraum.";

  const upcomingHintParts: string[] = [];
  if (upcomingConfirmed > 0) {
    upcomingHintParts.push(`${numberFormatter.format(upcomingConfirmed)} Zusagen`);
  }
  if (upcomingPending > 0) {
    upcomingHintParts.push(`${numberFormatter.format(upcomingPending)} offen/unsicher`);
  }
  if (upcomingDeclined > 0) {
    upcomingHintParts.push(`${numberFormatter.format(upcomingDeclined)} Absagen`);
  }
  const upcomingHint = upcomingHintParts.length
    ? upcomingHintParts.join(" · ")
    : "Keine anstehenden Proben mit Rückmeldungen.";

  const tasksHint = openTaskCount > 0
    ? `${numberFormatter.format(overdueCount)} überfällig · ${numberFormatter.format(dueSoonCount)} in 7 Tagen`
    : "Keine offenen Aufgaben.";

  const displayName = getUserDisplayName(
    {
      firstName: member.firstName,
      lastName: member.lastName,
      name: member.name,
      email: member.email,
    },
    "Unbekanntes Mitglied",
  );

  const systemRoles = sortRoles([
    member.role as Role,
    ...member.roles.map((entry: { role: Role }) => entry.role as Role),
  ]);

  const customRoles = member.appRoles
    .map((entry: { role: { id: string; name: string; systemRole: Role | null; isSystem: boolean } | null }) => entry.role)
    .filter(
      (role: { id: string; name: string; systemRole: Role | null; isSystem: boolean } | null): role is {
        id: string; name: string; systemRole: Role | null; isSystem: boolean
      } => Boolean(role),
    )
    .filter((role: { id: string; name: string; systemRole: Role | null; isSystem: boolean }) => !role.systemRole)
    .map((role: { id: string; name: string }) => ({ id: role.id, name: role.name }));

  const interestNames: string[] = Array.from(
    new Set<string>(
      member.interests
        .map((entry: { interest: { name: string | null } | null }) => entry.interest?.name?.trim() ?? null)
        .filter((value: string | null): value is string => Boolean(value && value.length > 0)),
    ),
  );

  const photoConsentInfo = resolvePhotoConsent(member.photoConsent);
  const photoConsentUpdatedAt = formatDateTime(photoConsentInfo.updatedAt);

  const memberSinceLabel = member.onboardingProfile?.memberSinceYear
    ? `Seit ${member.onboardingProfile.memberSinceYear}`
    : `Seit ${formatDate(member.createdAt)}`;

  const onboardingFocus = (member.onboardingProfile?.focus ?? null) as OnboardingFocus | null;
  const onboardingFocusLabel = onboardingFocus ? ONBOARDING_FOCUS_LABELS[onboardingFocus] : "Kein Schwerpunkt hinterlegt";

  const onboardingBackground = member.onboardingProfile?.background?.trim() ?? null;
  const onboardingNotes = member.onboardingProfile?.notes?.trim() ?? null;

  const email = member.email?.trim() ?? null;
  const dateOfBirthLabel = formatDate(member.dateOfBirth);
  const createdAtLabel = formatDateTime(member.createdAt);
  const deactivatedAt = member.deactivatedAt ?? null;
  const isDeactivated = Boolean(deactivatedAt);
  const deactivatedAtLabel = formatDateTime(deactivatedAt);

  const pageTitle = `Profil von ${displayName}`;
  const breadcrumbs = [
    membersNavigationBreadcrumb("/mitglieder/mitgliederverwaltung"),
    { id: member.id, label: displayName, isCurrent: true },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title={pageTitle}
        description="Einblick in Kontaktdaten, Rollen und Engagement des Mitglieds."
        breadcrumbs={breadcrumbs}
        actions={
          <Button
            asChild
            size="sm"
            variant="outline"
            className="gap-2 rounded-full border-border/70 bg-background/80 px-4 backdrop-blur transition hover:border-primary/50 hover:bg-primary/10"
          >
            <Link href="/mitglieder/mitgliederverwaltung">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Zurück zur Übersicht
            </Link>
          </Button>
        }
      />
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="flex w-full justify-start overflow-x-auto rounded-full border border-border/70 bg-background/70 p-1 shadow-inner ring-1 ring-primary/10 backdrop-blur">
          <TabsTrigger value="overview" className="gap-2 px-5 py-2 text-xs font-semibold uppercase tracking-wide sm:text-sm">
            <Sparkles className="h-4 w-4 text-muted-foreground/80" aria-hidden />
            <span>Profil</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2 px-5 py-2 text-xs font-semibold uppercase tracking-wide sm:text-sm">
            <Activity className="h-4 w-4 text-muted-foreground/80" aria-hidden />
            <span>Aktivität</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)] xl:items-start xl:gap-10 2xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)] 2xl:gap-12">
            <div className="space-y-6">
              <Card className="border border-border/70 bg-gradient-to-br from-background/85 via-background/70 to-background/80">
                <CardHeader className="space-y-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <UserAvatar
                        userId={member.id}
                        firstName={member.firstName}
                        lastName={member.lastName}
                        name={displayName}
                        email={email}
                        avatarSource={member.avatarSource}
                        avatarUpdatedAt={member.avatarImageUpdatedAt?.toISOString() ?? null}
                        size={76}
                        className="h-[76px] w-[76px] border-border/80 text-xl shadow-sm"
                      />
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-xl font-semibold leading-tight text-foreground">{displayName}</CardTitle>
                          {isDeactivated && (
                            <Badge variant="destructive" className="text-[10px] uppercase tracking-wide">
                              Deaktiviert
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CalendarDays className="h-4 w-4" aria-hidden />
                          {memberSinceLabel}
                        </div>
                        {isDeactivated && (
                          <div className="text-xs text-destructive">
                            {deactivatedAtLabel ? `Konto deaktiviert seit ${deactivatedAtLabel}.` : "Konto ist aktuell deaktiviert."}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {systemRoles.length ? (
                      systemRoles.map((role) => (
                        <span
                          key={role}
                          className={cn(
                            "inline-flex items-center rounded-full border px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wide shadow-sm",
                            ROLE_BADGE_VARIANTS[role],
                          )}
                        >
                          {ROLE_LABELS[role] ?? role}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">Keine Systemrollen zugewiesen.</span>
                    )}
                  </div>

                  {customRoles.length ? (
                    <div className="flex flex-wrap gap-2">
                      {customRoles.map((role: { id: string; name: string }) => (
                        <Badge key={role.id} variant="secondary" className="border-primary/30 bg-primary/10 text-primary">
                          {role.name}
                        </Badge>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" aria-hidden />
                    {email ? (
                      <a href={`mailto:${email}`} className="font-medium text-foreground transition hover:text-primary">
                        {email}
                      </a>
                    ) : (
                      <span className="italic text-muted-foreground">Keine E-Mail hinterlegt</span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-border/70">
                <CardHeader className="space-y-1.5">
                  <CardTitle className="text-lg">Team-Engagement</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Überblick über Onboarding-Schwerpunkt und Fotoeinverständnis des Mitglieds.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-border/60 bg-background/70 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Sparkles className="h-4 w-4" aria-hidden />
                      Schwerpunkt im Onboarding
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{onboardingFocusLabel}</p>
                    {onboardingBackground ? (
                      <p className="mt-2 text-xs text-muted-foreground">{onboardingBackground}</p>
                    ) : null}
                    {onboardingNotes ? (
                      <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{onboardingNotes}</p>
                    ) : null}
                  </div>

                  <div className="rounded-lg border border-border/60 bg-background/70 p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <ShieldCheck className="h-4 w-4" aria-hidden />
                      Fotoeinverständnis
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "gap-2 rounded-full px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wide",
                          photoConsentInfo.className,
                        )}
                      >
                        {photoConsentInfo.label}
                      </Badge>
                      {photoConsentUpdatedAt ? (
                        <span className="text-xs text-muted-foreground">Stand: {photoConsentUpdatedAt}</span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{photoConsentInfo.description}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border border-border/70">
                <CardHeader className="space-y-2">
                  <CardTitle>Stammdaten</CardTitle>
                  <p className="text-sm text-muted-foreground">Zentrale Kontaktdaten und interne Kennungen des Mitglieds.</p>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vorname</dt>
                      <dd className="text-sm font-medium text-foreground">{member.firstName?.trim() || "—"}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nachname</dt>
                      <dd className="text-sm font-medium text-foreground">{member.lastName?.trim() || "—"}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Anzeigename</dt>
                      <dd className="text-sm font-medium text-foreground">{member.name?.trim() || "—"}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">E-Mail</dt>
                      <dd className="text-sm font-medium text-foreground">
                        {email ? (
                          <a href={`mailto:${email}`} className="transition hover:text-primary">
                            {email}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Geburtsdatum</dt>
                      <dd className="text-sm font-medium text-foreground">{dateOfBirthLabel}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Konto erstellt</dt>
                      <dd className="text-sm font-medium text-foreground">{createdAtLabel ?? "—"}</dd>
                    </div>
                    <div className="space-y-1">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mitglieds-ID</dt>
                      <dd className="text-xs font-mono text-muted-foreground">{member.id}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {canSendTestNotifications ? (
                <MemberTestNotificationCard
                  userId={member.id}
                  displayName={displayName}
                  hasEmail={Boolean(email)}
                />
              ) : null}

              <Card className="border border-border/70">
                <CardHeader className="space-y-2">
                  <CardTitle>Rollen &amp; Berechtigungen</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Übersicht über zugewiesene Systemrollen und optionale Zusatzrollen.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Systemrollen</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {systemRoles.length ? (
                        systemRoles.map((role) => (
                          <span
                            key={role}
                            className={cn(
                              "inline-flex items-center rounded-full border px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wide shadow-sm",
                              ROLE_BADGE_VARIANTS[role],
                            )}
                          >
                            {ROLE_LABELS[role] ?? role}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">Keine Systemrollen vergeben.</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Zusätzliche Rollen</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {customRoles.length ? (
                        customRoles.map((role: { id: string; name: string }) => (
                          <Badge key={role.id} variant="outline" className="border-primary/30 bg-primary/5 text-primary">
                            {role.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">Keine zusätzlichen Rollen hinterlegt.</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-border/70">
                <CardHeader className="space-y-2">
                  <CardTitle>Interessen &amp; Talente</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Schlagworte aus dem Mitgliederprofil unterstützen bei der Planung von Besetzungen und Aufgaben.
                  </p>
                </CardHeader>
                <CardContent>
                  {interestNames.length ? (
                    <div className="flex flex-wrap gap-2">
                      {interestNames.map((interest) => (
                        <Badge
                          key={interest}
                          variant="outline"
                          className="border-primary/30 bg-primary/5 text-primary"
                        >
                          {interest}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Noch keine Interessen hinterlegt.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <ActivityStatCard
              label="Rückmeldungen (12 Monate)"
              value={totalResponsesLabel}
              hint={responsesHint}
              icon={<BarChart3 className="h-5 w-5" aria-hidden />}
            />
            <ActivityStatCard
              label="Zusagequote"
              value={acceptanceRateLabel}
              hint={
                totalResponses > 0
                  ? `${numberFormatter.format(attendanceStatusCounts.yes)} von ${totalResponsesLabel} Zusagen`
                  : "Noch keine Rückmeldungen erfasst."
              }
              icon={<Activity className="h-5 w-5" aria-hidden />}
            />
            <ActivityStatCard
              label="Kommende Proben"
              value={numberFormatter.format(upcomingTotal)}
              hint={upcomingHint}
              icon={<CalendarClock className="h-5 w-5" aria-hidden />}
            />
            <ActivityStatCard
              label="Offene Aufgaben"
              value={numberFormatter.format(openTaskCount)}
              hint={tasksHint}
              icon={<ListChecks className="h-5 w-5" aria-hidden />}
            />
          </div>

          <Card className="border border-border/70">
            <CardHeader className="space-y-2">
              <CardTitle>Antwortverlauf</CardTitle>
              <p className="text-sm text-muted-foreground">
                Entwicklung der Rückmeldungen in den letzten sechs Monaten.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasMonthlyData ? (
                monthlyStats.map((month) => (
                  <div key={month.key} className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-medium text-foreground">
                      <span>{month.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {month.total} Rückmeldungen
                      </span>
                    </div>
                    <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                      {ATTENDANCE_STATUS_ORDER.map((status) => {
                        const value = month[status];
                        if (!month.total || value === 0) return null;
                        const width = (value / month.total) * 100;
                        return (
                          <span
                            key={`${month.key}-${status}`}
                            className={cn("h-full", ATTENDANCE_STATUS_SEGMENT_CLASSES[status] ?? DEFAULT_SEGMENT_CLASS)}
                            style={{ width: `${width}%` }}
                          />
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {ATTENDANCE_STATUS_ORDER.map((status) => (
                        <span key={`${month.key}-${status}-label`}>
                          {ATTENDANCE_STATUS_LABELS[status]}: {month[status]}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Für den ausgewählten Zeitraum liegen noch keine Rückmeldungen vor.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border/70">
            <CardHeader className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" aria-hidden />
                  Aktivitätshistorie
                </CardTitle>
                {lastActivityRelative || lastActivityAbsolute ? (
                  <span className="text-xs text-muted-foreground">
                    Zuletzt aktualisiert {lastActivityRelative ?? lastActivityAbsolute}
                    {lastActivityRelative && lastActivityAbsolute ? ` (${lastActivityAbsolute})` : null}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Noch keine Änderungen protokolliert</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Protokoll der Statusänderungen rund um Probenrückmeldungen.
              </p>
            </CardHeader>
            <CardContent>
              {activityEntries.length ? (
                <ol className="relative space-y-6 border-l border-border/60 pl-6">
                  {activityEntries.map((entry) => (
                    <li key={entry.id} className="relative">
                      <span
                        className={cn(
                          "absolute -left-[9px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background",
                          entry.dotClass ?? DEFAULT_DOT_CLASS,
                        )}
                        aria-hidden
                      />
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                          <span>{entry.description}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide",
                              entry.badgeClass,
                            )}
                          >
                            {entry.statusLabel}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>{entry.rehearsalTitle}</span>
                          {entry.rehearsalDateLabel ? <span>{entry.rehearsalDateLabel}</span> : null}
                          <span>
                            Aktualisiert {entry.changedAtRelative ?? entry.changedAtLabel} durch {entry.changedBy}
                          </span>
                          {entry.changedAtRelative && entry.changedAtLabel ? (
                            <span className="text-muted-foreground/70">({entry.changedAtLabel})</span>
                          ) : null}
                        </div>
                        {entry.comment ? (
                          <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
                            {entry.comment}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Für dieses Mitglied wurden bisher keine Aktivitätsprotokolle gespeichert.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border/70">
            <CardHeader className="space-y-2">
              <CardTitle>Aufgabenstatus</CardTitle>
              <p className="text-sm text-muted-foreground">
                Überblick über zugewiesene Aufgaben im Departments-Kontext.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {(Object.keys(taskStatusCounts) as TaskStatus[]).map((status) => (
                  <div
                    key={status}
                    className="rounded-md border border-border/60 bg-background/70 p-3 text-sm shadow-sm"
                  >
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {TASK_STATUS_LABELS[status]}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-foreground">
                      {numberFormatter.format(taskStatusCounts[status])}
                    </div>
                  </div>
                ))}
              </div>

              {prioritizedTaskEntries.length ? (
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Dringend zu beachten
                  </div>
                  <ul className="space-y-2">
                    {prioritizedTaskEntries.map((task) => (
                      <li
                        key={task.id}
                        className="rounded-md border border-border/60 bg-background/60 p-3 text-sm"
                      >
                        <div className="font-medium text-foreground">{task.title}</div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {task.department ? <span>{task.department}</span> : null}
                          {task.dueAt ? (
                            <span>
                              Fällig {task.dueLabel}
                              {task.dueRelative ? ` (${task.dueRelative})` : ""}
                            </span>
                          ) : (
                            <span>Keine Fälligkeit</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {otherOpenTaskCount > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Plus {numberFormatter.format(otherOpenTaskCount)} weitere offene Aufgabe
                      {otherOpenTaskCount > 1 ? "n" : ""} ohne dringende Frist.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Es sind keine dringenden Aufgaben für dieses Mitglied vermerkt.
                </p>
              )}

              {openTaskCount === 0 && completedTaskCount > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Bereits erledigt: {numberFormatter.format(completedTaskCount)} Aufgabe
                  {completedTaskCount > 1 ? "n" : ""}.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
