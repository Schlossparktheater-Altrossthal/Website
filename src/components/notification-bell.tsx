"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Bell, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNotificationRealtime } from "@/hooks/useRealtime";
import { useMediaQuery } from "@/hooks/useMediaQuery";

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
  attendanceStatus: "yes" | "no" | null;
};

type AttendanceResponse = "yes" | "no";

type NotificationRealtimeEvent = {
  notification: {
    id: string;
    title: string;
    body?: string | null;
  };
};

export function NotificationBell({ className }: { className?: string }) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
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
      toast.info(event.notification.title, {
        description: event.notification.body ?? undefined,
      });
      void loadNotifications();
    },
    [status, loadNotifications],
  );

  useNotificationRealtime(handleRealtimeNotification);

  const respond = useCallback(
    async (notificationId: string, response: AttendanceResponse) => {
      setRespondingId(`${notificationId}:${response}`);
      try {
        const result = await fetch("/api/notifications/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipientId: notificationId, response }),
        });

        if (!result.ok) {
          throw new Error("Request failed");
        }

        toast.success(response === "yes" ? "Zusage gespeichert." : "Absage gespeichert.");
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === notificationId
              ? { ...item, attendanceStatus: response, readAt: new Date().toISOString() }
              : item,
          ),
        );
      } catch (error) {
        console.error("[NotificationBell] respond failed", error);
        toast.error("Antwort konnte nicht gespeichert werden.");
      } finally {
        setRespondingId(null);
      }
    },
    [],
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
    </div>
  );
}

type NotificationContentProps = {
  notifications: NotificationItem[];
  loading: boolean;
  respondingId: string | null;
  onRespond: (notificationId: string, response: AttendanceResponse) => void;
  scrollAreaClassName?: string;
  onClearRead: () => void;
};

function NotificationContent({
  notifications,
  loading,
  respondingId,
  onRespond,
  scrollAreaClassName,
  onClearRead,
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
          <NotificationList notifications={notifications} respondingId={respondingId} onRespond={onRespond} />
        </div>
      )}
    </div>
  );
}

type NotificationListProps = {
  notifications: NotificationItem[];
  respondingId: string | null;
  onRespond: (notificationId: string, response: AttendanceResponse) => void;
};

function NotificationList({ notifications, respondingId, onRespond }: NotificationListProps) {
  return (
    <ul className="space-y-3">
      {notifications.map((item) => (
        <NotificationEntry
          key={item.id}
          item={item}
          respondingId={respondingId}
          onRespond={onRespond}
        />
      ))}
    </ul>
  );
}

type NotificationEntryProps = {
  item: NotificationItem;
  respondingId: string | null;
  onRespond: (notificationId: string, response: AttendanceResponse) => void;
};

function NotificationEntry({ item, respondingId, onRespond }: NotificationEntryProps) {
  const busy = respondingId?.startsWith(`${item.id}:`) ?? false;
  const hasResponse = item.attendanceStatus === "yes" || item.attendanceStatus === "no";
  const startDate = item.rehearsal ? new Date(item.rehearsal.start) : null;
  const createdAt = new Date(item.createdAt);
  const isUpdate = (item.type ?? "") === "rehearsal-update";
  // Hervorhebung nur solange die Aktualisierung noch ungelesen ist
  const highlight = isUpdate && hasResponse && !item.readAt;
  const canRemoveSingle = Boolean(item.readAt);

  return (
    <li
      className={cn(
        "rounded-lg border p-3 shadow-sm",
        highlight
          ? "border-primary/60 bg-primary/10 shadow-[0_0_0_1px_rgba(129,140,248,0.25)]"
          : "border-border/40 bg-background/85",
      )}
    >
      <article className="space-y-3">
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <h3 className="text-sm font-medium text-foreground break-words flex items-center gap-2">
              <span>{item.title}</span>
              {highlight && (
                <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[0.7rem] font-medium text-primary">
                  Aktualisiert
                </span>
              )}
            </h3>
            {item.body && (
              <p className="text-xs text-muted-foreground leading-snug break-words">{item.body}</p>
            )}
            <div className="space-y-0.5 text-[0.7rem] text-muted-foreground">
              <time dateTime={createdAt.toISOString()} className="block">
                Erhalten: {dateTimeFormatter.format(createdAt)}
              </time>
              {startDate && (
                <time dateTime={startDate.toISOString()} className="block">
                  Probe: {dateTimeFormatter.format(startDate)}
                </time>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-start gap-2">
            {hasResponse && (
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium",
                  item.attendanceStatus === "yes"
                    ? "bg-emerald-500/20 text-emerald-200"
                    : "bg-rose-500/20 text-rose-200",
                )}
              >
                {item.attendanceStatus === "yes" ? <Check size={12} /> : <X size={12} />}
                {item.attendanceStatus === "yes" ? "Zusage" : "Absage"}
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
                    // remove locally
                    // fall back to state update via custom event
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

        {!hasResponse && item.rehearsal ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              size="sm"
              className="w-full sm:w-auto"
              disabled={busy}
              onClick={() => onRespond(item.id, "yes")}
            >
              Zusagen
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={busy}
              onClick={() => onRespond(item.id, "no")}
            >
              Absagen
            </Button>
          </div>
        ) : null}
      </article>
    </li>
  );
}
