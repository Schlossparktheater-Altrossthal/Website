"use client";

import { BellIcon } from "@/components/ui/action-icons";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNotificationRealtime } from "@/hooks/useRealtime";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useBrowserNotifications } from "@/hooks/useBrowserNotifications";
import { NOTIFICATION_TYPES } from "@/lib/notifications/types";

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
  } | null;
  attendanceStatus: "yes" | "no" | "emergency" | null;
};

type NotificationRealtimeEvent = {
  notification: {
    id: string;
    title: string;
    body?: string | null;
    type?: "info" | "warning" | "success" | "error";
    actionUrl?: string | null;
  };
};

export function NotificationBell({ className }: { className?: string }) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useMediaQuery("(max-width: 640px)");
  const panelId = useId();
  const [permissionRequestPending, setPermissionRequestPending] = useState(false);

  const {
    isSupported: browserNotificationsSupported,
    permission: browserNotificationPermission,
    requestPermission: requestBrowserNotificationPermission,
    showNotification: showBrowserNotification,
  } = useBrowserNotifications();

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
        unreadIds.includes(item.id) ? { ...item, readAt: new Date().toISOString() } : item,
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

      if (browserNotificationsSupported) {
        const notificationUrlCandidates = [event.notification.actionUrl, "/mitglieder"];

        let resolvedNotificationUrl: string | null = null;

        for (const candidate of notificationUrlCandidates) {
          const trimmed = typeof candidate === "string" ? candidate.trim() : "";
          if (!trimmed) {
            continue;
          }

          try {
            resolvedNotificationUrl = new URL(trimmed, window.location.origin).toString();
            break;
          } catch (error) {
            if (process.env.NODE_ENV !== "production") {
              console.warn("[NotificationBell] invalid notification url", error);
            }
          }
        }

        void showBrowserNotification({
          title: event.notification.title,
          body: description,
          tag: event.notification.id,
          ...(resolvedNotificationUrl ? { url: resolvedNotificationUrl } : {}),
        });
      }

      void loadNotifications();
    },
    [status, loadNotifications, browserNotificationsSupported, showBrowserNotification],
  );

  useNotificationRealtime(handleRealtimeNotification);

  const handleEnableBrowserNotifications = useCallback(async () => {
    if (!browserNotificationsSupported) {
      toast.error("Browser-Benachrichtigungen werden von diesem Gerät nicht unterstützt.");
      return;
    }

    if (browserNotificationPermission === "granted") {
      toast.info("Browser-Benachrichtigungen sind bereits aktiviert.");
      return;
    }

    setPermissionRequestPending(true);
    try {
      const result = await requestBrowserNotificationPermission();
      if (result === "granted") {
        toast.success("Browser-Benachrichtigungen aktiviert.");
      } else if (result === "denied") {
        toast.error("Browser-Benachrichtigungen wurden blockiert.");
      } else {
        toast.info("Browser-Benachrichtigungen wurden nicht aktiviert.");
      }
    } catch (error) {
      console.error("[NotificationBell] enabling browser notifications failed", error);
      toast.error("Browser-Benachrichtigungen konnten nicht aktiviert werden.");
    } finally {
      setPermissionRequestPending(false);
    }
  }, [
    browserNotificationsSupported,
    browserNotificationPermission,
    requestBrowserNotificationPermission,
  ]);

  if (status === "loading") {
    return (
      <div
        className={cn(className, "h-9 w-9 animate-pulse rounded-full bg-foreground/10")}
        aria-hidden
      />
    );
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
      scrollAreaClassName={scrollAreaClassName}
      onClearRead={clearRead}
      browserNotificationsSupported={browserNotificationsSupported}
      browserPermission={browserNotificationsSupported ? browserNotificationPermission : null}
      onEnableBrowserNotifications={handleEnableBrowserNotifications}
      permissionRequestPending={permissionRequestPending}
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
        aria-label={
          unreadCount ? `${unreadCount} ungelesene Benachrichtigungen` : "Benachrichtigungen"
        }
      >
        <BellIcon size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[0.6rem] font-semibold text-primary-foreground">
            {unreadCount}
          </span>
        )}
      </button>

      {isMobile ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Benachrichtigungen</DialogTitle>
              {loading ? <DialogDescription>Aktualisiere…</DialogDescription> : null}
            </DialogHeader>
            {content}
          </DialogContent>
        </Dialog>
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
    </div>
  );
}

type NotificationContentProps = {
  notifications: NotificationItem[];
  loading: boolean;
  scrollAreaClassName?: string;
  onClearRead: () => void;
  browserNotificationsSupported: boolean;
  browserPermission: NotificationPermission | null;
  onEnableBrowserNotifications: () => void;
  permissionRequestPending: boolean;
};

function NotificationContent({
  notifications,
  loading,
  scrollAreaClassName,
  onClearRead,
  browserNotificationsSupported,
  browserPermission,
  onEnableBrowserNotifications,
  permissionRequestPending,
}: NotificationContentProps) {
  return (
    <div className="space-y-3 text-sm">
      <header
        className="flex items-center justify-between text-xs text-muted-foreground"
        aria-live="polite"
      >
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
      {browserNotificationsSupported && browserPermission && browserPermission !== "granted" && (
        <BrowserNotificationCallout
          permission={browserPermission}
          onEnable={onEnableBrowserNotifications}
          pending={permissionRequestPending}
        />
      )}
      {notifications.length === 0 ? (
        <p className="text-xs text-muted-foreground">Keine Benachrichtigungen vorhanden.</p>
      ) : (
        <div className={cn("space-y-3 overflow-y-auto pr-1", scrollAreaClassName)}>
          <NotificationList notifications={notifications} />
        </div>
      )}
    </div>
  );
}

type BrowserNotificationCalloutProps = {
  permission: NotificationPermission;
  onEnable: () => void;
  pending: boolean;
};

function BrowserNotificationCallout({
  permission,
  onEnable,
  pending,
}: BrowserNotificationCalloutProps) {
  if (permission === "granted") {
    return null;
  }

  const isBlocked = permission === "denied";

  return (
    <section className="rounded-lg border border-dashed border-primary/50 bg-primary/10 p-3 text-xs">
      <p className="mb-2 leading-relaxed text-muted-foreground">
        Aktiviere Browser-Benachrichtigungen, um auch außerhalb der Website sofort informiert zu
        bleiben.
      </p>
      {isBlocked ? (
        <p className="text-xs font-medium text-warning">
          Browser-Benachrichtigungen wurden blockiert. Bitte erlaube sie in den
          Browser-Einstellungen.
        </p>
      ) : (
        <Button type="button" size="sm" onClick={onEnable} disabled={pending}>
          {pending ? "Aktiviere…" : "Browser-Benachrichtigungen aktivieren"}
        </Button>
      )}
    </section>
  );
}

type NotificationListProps = {
  notifications: NotificationItem[];
};

function NotificationList({ notifications }: NotificationListProps) {
  return (
    <ul className="space-y-3">
      {notifications.map((item) => (
        <NotificationEntry key={item.id} item={item} />
      ))}
    </ul>
  );
}

type NotificationEntryProps = {
  item: NotificationItem;
};

function NotificationEntry({ item }: NotificationEntryProps) {
  const createdAt = new Date(item.createdAt);
  const startDate = item.rehearsal?.start ? new Date(item.rehearsal.start) : null;

  const typeKey = item.type ?? "";
  const isUpdate = typeKey === NOTIFICATION_TYPES.REHEARSAL_UPDATE;
  const isEmergencyAlert = typeKey === NOTIFICATION_TYPES.REHEARSAL_EMERGENCY;
  const isAttendanceAlert = typeKey === NOTIFICATION_TYPES.REHEARSAL_ATTENDANCE;

  const highlightUpdate = isUpdate && !item.readAt;
  const highlightEmergency = isEmergencyAlert && !item.readAt;
  const highlightAttendance = isAttendanceAlert && !item.readAt;

  const cardClass = cn(
    "rounded-lg border p-3 shadow-sm",
    highlightEmergency
      ? "border-destructive/70 bg-destructive/10"
      : highlightUpdate
        ? "border-primary/60 bg-primary/10"
        : highlightAttendance
          ? "border-warning/70 bg-warning/10"
          : "border-border/40 bg-background/85",
  );

  const badgeConfig = isEmergencyAlert
    ? { label: "Notfall", className: "bg-destructive/20 text-destructive" }
    : isUpdate
      ? { label: "Aktualisiert", className: "bg-primary/15 text-primary" }
      : isAttendanceAlert
        ? { label: "Absage", className: "bg-warning/20 text-warning" }
        : null;

  const canRemoveSingle = Boolean(item.readAt);

  return (
    <li className={cardClass}>
      <article className="space-y-3">
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <h3 className="text-sm font-medium text-foreground break-words flex items-center gap-2">
              {item.rehearsal ? (
                <Link
                  href={`/mitglieder/proben/${item.rehearsal.id}`}
                  className="text-primary hover:underline"
                >
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
                <Link
                  href={`/mitglieder/proben/${item.rehearsal.id}`}
                  className="block text-primary hover:underline"
                >
                  <time dateTime={startDate.toISOString()}>
                    Probe: {dateTimeFormatter.format(startDate)}
                  </time>
                </Link>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-start gap-2">
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
      </article>
    </li>
  );
}
