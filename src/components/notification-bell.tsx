"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Bell, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "short",
  timeStyle: "short",
});

type NotificationItem = {
  id: string;
  title: string;
  body?: string | null;
  createdAt: string;
  readAt: string | null;
  rehearsal?: {
    id: string;
    title: string;
    start: string;
  } | null;
  attendanceStatus: "yes" | "no" | null;
};

export function NotificationBell({ className }: { className?: string }) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = notifications.filter((item) => !item.readAt).length;

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!open) return;
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (!open) return;
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (status !== "authenticated") {
      setNotifications([]);
      return;
    }
    let active = true;
    setLoading(true);
    fetch("/api/notifications")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { notifications?: NotificationItem[] }) => {
        if (!active) return;
        setNotifications(data.notifications ?? []);
      })
      .catch(() => {
        if (active) {
          toast.error("Benachrichtigungen konnten nicht geladen werden.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [status]);

  useEffect(() => {
    if (!open) return;
    const unreadIds = notifications.filter((item) => !item.readAt).map((item) => item.id);
    if (!unreadIds.length) return;
    fetch("/api/notifications/read", {
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

  const respond = (notificationId: string, response: "yes" | "no") => {
    setRespondingId(`${notificationId}:${response}`);
    fetch("/api/notifications/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId: notificationId, response }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(() => {
        toast.success(response === "yes" ? "Zusage gespeichert." : "Absage gespeichert.");
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === notificationId
              ? { ...item, attendanceStatus: response, readAt: new Date().toISOString() }
              : item,
          ),
        );
      })
      .catch(() => {
        toast.error("Antwort konnte nicht gespeichert werden.");
      })
      .finally(() => {
        setRespondingId(null);
      });
  };

  if (status === "loading") {
    return <div className={cn(className, "h-9 w-9 animate-pulse rounded-full bg-foreground/10")} aria-hidden />;
  }

  if (!session?.user) {
    return null;
  }

  return (
    <div className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card/70 text-foreground/80 transition hover:bg-accent/30 focus:outline-none focus:ring-2 focus:ring-ring"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unreadCount ? `${unreadCount} ungelesene Benachrichtigungen` : "Benachrichtigungen"}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[0.6rem] font-semibold text-primary-foreground">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label="Benachrichtigungen"
          className="absolute right-0 z-50 mt-2 w-80 max-w-xs rounded-md border border-border/60 bg-card/95 p-3 text-sm shadow-lg"
        >
          <header className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Benachrichtigungen</span>
            {loading && <span>Aktualisiere…</span>}
          </header>

          {notifications.length === 0 ? (
            <p className="text-xs text-muted-foreground">Keine Benachrichtigungen vorhanden.</p>
          ) : (
            <ul className="space-y-3">
              {notifications.map((item) => {
                const startDate = item.rehearsal ? new Date(item.rehearsal.start) : null;
                const busy = respondingId?.startsWith(`${item.id}:`) ?? false;
                const hasResponse = item.attendanceStatus === "yes" || item.attendanceStatus === "no";
                return (
                  <li key={item.id} className="rounded border border-border/40 bg-background/80 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-foreground">{item.title}</div>
                        {item.body && (
                          <div className="text-xs text-muted-foreground">{item.body}</div>
                        )}
                        {startDate && (
                          <div className="text-xs text-muted-foreground">
                            {dateTimeFormatter.format(startDate)}
                          </div>
                        )}
                      </div>
                      {hasResponse && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                            item.attendanceStatus === "yes"
                              ? "bg-emerald-500/15 text-emerald-700"
                              : "bg-rose-500/15 text-rose-700",
                          )}
                        >
                          {item.attendanceStatus === "yes" ? <Check size={12} /> : <X size={12} />}
                          {item.attendanceStatus === "yes" ? "Zusage" : "Absage"}
                        </span>
                      )}
                    </div>
                    {!hasResponse && item.rehearsal ? (
                      <div className="mt-3 flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => respond(item.id, "yes")}
                          disabled={busy}
                        >
                          Zusagen
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => respond(item.id, "no")}
                          disabled={busy}
                        >
                          Absagen
                        </Button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
