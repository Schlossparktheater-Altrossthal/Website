"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { AlertTriangle, Bell, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNotificationRealtime } from "@/hooks/useRealtime";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { EmergencyDialog } from "@/components/dialogs/emergency-dialog";

const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});

type NotificationItem = {
  id: string;
  title: string;
  body?: string | null;
  createdAt: string;
  readAt: string | null;
  type?: string | null;
  rehearsal?: {
    id: string;
    title: string;
    start: string;
    registrationDeadline: string | null;
  } | null;
  attendanceStatus: "yes" | "no" | "emergency" | null;
};

type AttendanceResponse = "yes" | "no" | "emergency";

type NotificationRealtimeEvent = {
  notification: {
    id: string;
    title: string;
    body?: string | null;
    type?: "info" | "warning" | "success" | "error";
  };
};

type EmergencyTarget = {
  notificationId: string;
  label: string;
};

type RespondOptions = {
  reason?: string;
  skipSuccessToast?: boolean;
  rethrowOnError?: boolean;
};

export function NotificationBell({ className }: { className?: string }) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [emergencyTarget, setEmergencyTarget] = useState<EmergencyTarget | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useMediaQuery("(max-width: 640px)");
  const panelId = useId();

  const unreadCount = useMemo(
    () => notifications.reduce((count, item) => count + (item.readAt ? 0 : 1), 0),
    [notifications],
  );

  useEffect(() => {
    if (status !== "authenticated") {
      setOpen(false);
      setNotifications([]);
    }
  }, [status]);

  useEffect(() => {
    if (!open || isMobile) return;

    function onDocClick(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, isMobile]);

  const loadNotifications = useCallback(async () => {
    if (status !== "authenticated") {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Request failed");
      }
      const data: { notifications?: NotificationItem[] } = await response.json();
      setNotifications(data.notifications ?? []);
    } catch (error) {
      console.error("[NotificationBell] loadNotifications failed", error);
      toast.error("Benachrichtigungen konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  const clearRead = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_read" }),
      });
      if (!res.ok) throw new Error("cleanup failed");
      setNotifications((prev) => prev.filter((n) => !n.readAt));
      toast.success("Gelesene Benachrichtigungen entfernt.");
    } catch (e) {
      console.error("[NotificationBell] clearRead failed", e);
      toast.error("Konnte gelesene Benachrichtigungen nicht entfernen.");
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  // keep list in sync when a single item gets removed via UI
  useEffect(() => {
    function onRemoved(e: Event) {
      const detail = (e as CustomEvent<{ id: string }>).detail;
      if (!detail?.id) return;
      setNotifications((prev) => prev.filter((n) => n.id !== detail.id));
    }
    window.addEventListener("notification-removed", onRemoved as EventListener);
    return () => window.removeEventListener("notification-removed", onRemoved as EventListener);
  }, []);

  useEffect(() => {
    if (!open) return;
    const unreadIds = notifications.filter((item) => !item.readAt).map((item) => item.id);
    if (!unreadIds.length) return;

    void fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: unreadIds }),
    }).catch(() => null);

    setNotifications((prev) =>
      prev.map((item) =>
        unreadIds.includes(item.id)
          ? { ...item, readAt: new Date().toISOString() }
          : item,
      ),
    );
  }, [open, notifications]);

  const handleRealtimeNotification = useCallback(
    (event: NotificationRealtimeEvent) => {
      if (status !== "authenticated") return;
      const description = event.notification.body ?? undefined;
      const variant = event.notification.type ?? "info";

      switch (variant) {
        case "success":
          toast.success(event.notification.title, { description });
          break;
        case "warning":
          toast.warning(event.notification.title, { description });
          break;
        case "error":
          toast.error(event.notification.title, { description });
          break;
        default:
          toast.info(event.notification.title, { description });
      }

      void loadNotifications();
    },
    [status, loadNotifications],
  );

  useNotificationRealtime(handleRealtimeNotification);

  const respond = useCallback(
    async (
      notificationId: string,
      response: AttendanceResponse,
      options: RespondOptions = {},
    ) => {
      setRespondingId(`${notificationId}:${response}`);

      const payload: Record<string, unknown> = { recipientId: notificationId, response };
      if (options.reason) {
        payload.reason = options.reason;
      }

      try {
        const result = await fetch("/api/notifications/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data: { status?: AttendanceResponse; error?: string } | null = await result
          .json()
          .catch(() => null);

        if (!result.ok) {
          const message =
            (data?.error && typeof data.error === "string" && data.error.trim()) ||
            "Antwort konnte nicht gespeichert werden.";
          throw new Error(message);
        }

        const nextStatus = (data?.status as AttendanceResponse | undefined) ?? response;

        if (!options.skipSuccessToast) {
          const successMessage =
            nextStatus === "yes"
              ? "Zusage gespeichert."
              : nextStatus === "no"
              ? "Absage gespeichert."
              : "Notfall wurde gemeldet.";

          if (successMessage) {
            toast.success(successMessage);
          }
        }

        setNotifications((prev) =>
          prev.map((item) =>
            item.id === notificationId
              ? { ...item, attendanceStatus: nextStatus, readAt: new Date().toISOString() }
              : item,
          ),
        );

        return nextStatus;
      } catch (error) {
        console.error("[NotificationBell] respond failed", error);
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Antwort konnte nicht gespeichert werden.";
        toast.error(message);
        if (options.rethrowOnError) {
          throw error instanceof Error ? error : new Error(message);
        }
        return null;
      } finally {
        setRespondingId(null);
      }
    },
    [],
  );

  const openEmergencyDialog = useCallback(
    (notificationId: string) => {
      const target = notifications.find((item) => item.id === notificationId);
      if (!target) return;

      const rehearsalTitle = target.rehearsal?.title?.trim();
      let label = rehearsalTitle && rehearsalTitle.length ? rehearsalTitle : target.title;

      if ((!label || label === target.title) && target.rehearsal?.start) {
        const startDate = new Date(target.rehearsal.start);
        if (!Number.isNaN(startDate.valueOf())) {
          label = `Probe am ${dateTimeFormatter.format(startDate)}`;
        }
      }

      setEmergencyTarget({ notificationId, label });
    },
    [notifications],
  );

  if (status === "loading") {
    return <div className={cn(className, "h-9 w-9 animate-pulse rounded-full bg-foreground/10")} aria-hidden />;
  }

  if (!session?.user) {
    return null;
  }

  const toggleOpen = () => {
    setOpen((previous) => {
      const next = !previous;
      if (!previous) {
        void loadNotifications();
      }
      return next;
    });
  };

  const scrollAreaClassName = isMobile ? "max-h-[60vh]" : "max-h-[min(70vh,24rem)]";

  const content = (
    <NotificationContent
      notifications={notifications}
      loading={loading}
      respondingId={respondingId}
      onRespond={respond}
      scrollAreaClassName={scrollAreaClassName}
      onClearRead={clearRead}
      onRequestEmergency={openEmergencyDialog}
    />
  );

  return (
    <div className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card/70 text-foreground/80 transition hover:bg-accent/30 focus:outline-none focus:ring-2 focus:ring-ring"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={!isMobile && open ? panelId : undefined}
        aria-label={unreadCount ? `${unreadCount} ungelesene Benachrichtigungen` : "Benachrichtigungen"}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[0.6rem] font-semibold text-primary-foreground">
            {unreadCount}
          </span>
        )}
      </button>

      {isMobile ? (
        <Modal
          open={open}
          title="Benachrichtigungen"
          description={loading ? "Aktualisiere…" : undefined}
          onClose={() => setOpen(false)}
        >
          {content}
        </Modal>
      ) : (
        open && (
          <div
            ref={panelRef}
            id={panelId}
            role="menu"
            aria-label="Benachrichtigungen"
            className="absolute right-0 z-50 mt-3 w-[min(20rem,calc(100vw-1.5rem))] rounded-lg border border-border/60 bg-card/95 p-4 text-sm shadow-lg backdrop-blur"
          >
            {content}
          </div>
        )
      )}
      <EmergencyDialog
        isOpen={Boolean(emergencyTarget)}
        rehearsalTitle={emergencyTarget?.label}
        onClose={() => setEmergencyTarget(null)}
        onSubmit={async (reason) => {
          if (!emergencyTarget) return;
          await respond(emergencyTarget.notificationId, "emergency", {
            reason,
            skipSuccessToast: true,
            rethrowOnError: true,
          });
        }}
      />
    </div>
  );
}

type NotificationContentProps = {
  notifications: NotificationItem[];
  loading: boolean;
  respondingId: string | null;
  onRespond: (
    notificationId: string,
    response: AttendanceResponse,
  ) => Promise<AttendanceResponse | null> | null;
  scrollAreaClassName?: string;
  onClearRead: () => void;
  onRequestEmergency: (notificationId: string) => void;
};

function NotificationContent({
  notifications,
  loading,
  respondingId,
  onRespond,
  scrollAreaClassName,
  onClearRead,
  onRequestEmergency,
}: NotificationContentProps) {
  return (
    <div className="space-y-3 text-sm">
      <header className="flex items-center justify-between text-xs text-muted-foreground" aria-live="polite">
        <span>Benachrichtigungen</span>
        <span className="flex items-center gap-2">
          {loading && <span>Aktualisiere…</span>}
          {!loading && notifications.some((n) => n.readAt) && (
            <Button type="button" size="sm" variant="outline" onClick={onClearRead}>
              Gelesene löschen
            </Button>
          )}
        </span>
      </header>
      {notifications.length === 0 ? (
        <p className="text-xs text-muted-foreground">Keine Benachrichtigungen vorhanden.</p>
      ) : (
        <div className={cn("space-y-3 overflow-y-auto pr-1", scrollAreaClassName)}>
          <NotificationList
            notifications={notifications}
            respondingId={respondingId}
            onRespond={onRespond}
            onRequestEmergency={onRequestEmergency}
          />
        </div>
      )}
    </div>
  );
}

type NotificationListProps = {
  notifications: NotificationItem[];
  respondingId: string | null;
  onRespond: (
    notificationId: string,
    response: AttendanceResponse,
  ) => Promise<AttendanceResponse | null> | null;
  onRequestEmergency: (notificationId: string) => void;
};

function NotificationList({ notifications, respondingId, onRespond, onRequestEmergency }: NotificationListProps) {
  return (
    <ul className="space-y-3">
      {notifications.map((item) => (
        <NotificationEntry
          key={item.id}
          item={item}
          respondingId={respondingId}
          onRespond={onRespond}
          onRequestEmergency={onRequestEmergency}
        />
      ))}
    </ul>
  );
}

type NotificationEntryProps = {
  item: NotificationItem;
  respondingId: string | null;
  onRespond: (
    notificationId: string,
    response: AttendanceResponse,
  ) => Promise<AttendanceResponse | null> | null;
  onRequestEmergency: (notificationId: string) => void;
};

function NotificationEntry({ item, respondingId, onRespond, onRequestEmergency }: NotificationEntryProps) {
  const busy = respondingId?.startsWith(`${item.id}:`) ?? false;
  const createdAt = new Date(item.createdAt);
  const startDate = item.rehearsal?.start ? new Date(item.rehearsal.start) : null;
  const rawDeadline = item.rehearsal?.registrationDeadline
    ? new Date(item.rehearsal.registrationDeadline)
    : null;
  const deadlineDate = rawDeadline && !Number.isNaN(rawDeadline.valueOf()) ? rawDeadline : null;
  const deadlinePassed = deadlineDate ? Date.now() > deadlineDate.getTime() : false;

  const hasResponse =
    item.attendanceStatus === "yes" ||
    item.attendanceStatus === "no" ||
    item.attendanceStatus === "emergency";

  const typeKey = item.type ?? "";
  const isUpdate = typeKey === "rehearsal-update";
  const isEmergencyAlert = typeKey === "rehearsal-emergency";
  const isAttendanceAlert = typeKey === "rehearsal-attendance";

  const highlightUpdate = isUpdate && hasResponse && !item.readAt;
  const highlightEmergency = isEmergencyAlert && !item.readAt;
  const highlightAttendance = isAttendanceAlert && !item.readAt;

  const cardClass = cn(
    "rounded-lg border p-3 shadow-sm",
    highlightEmergency
      ? "border-rose-400/70 bg-rose-500/10 shadow-[0_0_0_1px_rgba(244,63,94,0.35)]"
      : highlightUpdate
      ? "border-primary/60 bg-primary/10 shadow-[0_0_0_1px_rgba(129,140,248,0.25)]"
      : highlightAttendance
      ? "border-amber-400/70 bg-amber-500/10 shadow-[0_0_0_1px_rgba(251,191,36,0.25)]"
      : "border-border/40 bg-background/85",
  );

  const statusBadge =
    item.attendanceStatus === "yes"
      ? { label: "Zusage", icon: <Check size={12} />, className: "bg-emerald-500/20 text-emerald-200" }
      : item.attendanceStatus === "no"
      ? { label: "Absage", icon: <X size={12} />, className: "bg-rose-500/20 text-rose-200" }
      : item.attendanceStatus === "emergency"
      ? { label: "Notfall", icon: <AlertTriangle size={12} />, className: "bg-amber-500/20 text-amber-100" }
      : null;

  const badgeConfig = isEmergencyAlert
    ? { label: "Notfall", className: "bg-rose-500/20 text-rose-100" }
    : isUpdate
    ? { label: "Aktualisiert", className: "bg-primary/15 text-primary" }
    : isAttendanceAlert
    ? { label: "Absage", className: "bg-amber-500/20 text-amber-100" }
    : null;

  const canRemoveSingle = Boolean(item.readAt);
  const showActionRow = !hasResponse && Boolean(item.rehearsal);
  const showStandardCancel = showActionRow && !deadlinePassed;

  return (
    <li className={cardClass}>
      <article className="space-y-3">
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <h3 className="text-sm font-medium text-foreground break-words flex items-center gap-2">
              {item.rehearsal ? (
                <Link href={`/mitglieder/proben/${item.rehearsal.id}`} className="text-primary hover:underline">
                  {item.title}
                </Link>
              ) : (
                <span>{item.title}</span>
              )}
              {badgeConfig && (
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[0.7rem] font-medium",
                    badgeConfig.className,
                  )}
                >
                  {badgeConfig.label}
                </span>
              )}
            </h3>
            {item.body && (
              <p className="text-xs text-muted-foreground leading-snug break-words whitespace-pre-line">
                {item.body}
              </p>
            )}
            <div className="space-y-0.5 text-[0.7rem] text-muted-foreground">
              <time dateTime={createdAt.toISOString()} className="block">
                Erhalten: {dateTimeFormatter.format(createdAt)}
              </time>
              {startDate && item.rehearsal && (
                <Link href={`/mitglieder/proben/${item.rehearsal.id}`} className="block text-primary hover:underline">
                  <time dateTime={startDate.toISOString()}>
                    Probe: {dateTimeFormatter.format(startDate)}
                  </time>
                </Link>
              )}
              {deadlineDate && (
                <time dateTime={deadlineDate.toISOString()} className="block">
                  Rückmeldefrist: {dateTimeFormatter.format(deadlineDate)}
                </time>
              )}
            </div>
            {deadlinePassed && !hasResponse && (
              <p className="text-xs font-semibold text-amber-600">
                Rückmeldefrist abgelaufen – bitte Notfall melden, falls du ausfällst.
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-start gap-2">
            {statusBadge && (
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium",
                  statusBadge.className,
                )}
              >
                {statusBadge.icon}
                {statusBadge.label}
              </span>
            )}
            {canRemoveSingle && (
              <button
                type="button"
                className="rounded-md border border-border/40 px-2 py-1 text-[0.7rem] text-muted-foreground hover:bg-accent/30"
                onClick={async () => {
                  try {
                    await fetch("/api/notifications/cleanup", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "delete_ids", ids: [item.id] }),
                    });
                    window.dispatchEvent(
                      new CustomEvent("notification-removed", { detail: { id: item.id } }),
                    );
                  } catch (error) {
                    console.error("[NotificationBell] remove notification failed", error);
                    toast.error("Benachrichtigung konnte nicht entfernt werden");
                  }
                }}
              >
                Entfernen
              </button>
            )}
          </div>
        </header>

        {showActionRow ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              size="sm"
              className="w-full sm:w-auto"
              disabled={busy}
              onClick={() => {
                void onRespond(item.id, "yes");
              }}
            >
              Zusagen
            </Button>
            {showStandardCancel ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full sm:w-auto"
                disabled={busy}
                onClick={() => {
                  void onRespond(item.id, "no");
                }}
              >
                Absagen
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="w-full sm:w-auto"
                disabled={busy}
                onClick={() => onRequestEmergency(item.id)}
              >
                Notfall melden
              </Button>
            )}
          </div>
        ) : null}
      </article>
    </li>
  );
}
