"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { toast } from "sonner";

import { BellIcon, BellRingIcon, CheckCheckIcon, SettingsIcon } from "@/components/ui/action-icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { DismissibleNotice } from "@/components/ui/dismissible-notice";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CategoryChips,
  NotificationSections,
  useRovingNotificationFocus,
} from "@/components/notifications/notification-sections";
import { useInbox } from "@/components/notifications/use-inbox";
import { useBrowserNotifications } from "@/hooks/useBrowserNotifications";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useNotificationRealtime } from "@/hooks/useRealtime";
import type { NotificationCategory } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

type NotificationRealtimeEvent = {
  notification: {
    id: string;
    title: string;
    body?: string | null;
    type?: "info" | "warning" | "success" | "error";
    actionUrl?: string | null;
  };
};

const PANEL_LIMITS = { action: 8, new: 8, earlier: 5 } as const;

/**
 * Glocke im Kopf: Badge mit offenen Einträgen, am Desktop ein Popover, mobil ein Blatt von
 * unten. Zeigt zuerst, was zu tun ist; alles Weitere auf `/mitglieder/benachrichtigungen`.
 */
export function NotificationBell({ className }: { className?: string }) {
  const { data: session, status } = useSession();
  const authenticated = status === "authenticated";
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<NotificationCategory | undefined>();
  const isDesktop = useMediaQuery("(min-width: 640px)");
  const inbox = useInbox({ category, limit: 30 }, { enabled: authenticated });
  const { counts, groups, update, reload } = inbox;
  const onKeyDown = useRovingNotificationFocus();

  const openCount = counts.action + counts.new;
  const urgent = counts.urgent > 0;

  // Beim Schließen gelten die gezeigten neuen Hinweise als gelesen – nicht schon beim
  // Öffnen, damit man sie beim Durchsehen noch als neu erkennt.
  const seenNew = useRef<string[]>([]);
  useEffect(() => {
    if (open) {
      seenNew.current = inbox.items
        .filter((item) => item.kind === "info" && !item.readAt)
        .map((item) => item.id);
    }
  }, [open, inbox.items]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next) {
        void reload();
      } else {
        if (seenNew.current.length) void update("read", { ids: seenNew.current });
        seenNew.current = [];
        setCategory(undefined);
      }
    },
    [reload, update],
  );

  const {
    isSupported: browserSupported,
    permission: browserPermission,
    requestPermission,
    showNotification,
  } = useBrowserNotifications();
  const push = usePushSubscription();

  const handleRealtime = useCallback(
    (event: NotificationRealtimeEvent) => {
      const { title, body, type = "info", actionUrl, id } = event.notification;
      const description = body ?? undefined;
      const show = {
        success: toast.success,
        warning: toast.warning,
        error: toast.error,
        info: toast.info,
      }[type];
      show(title, {
        description,
        ...(actionUrl
          ? { action: { label: "Öffnen", onClick: () => window.location.assign(actionUrl) } }
          : {}),
      });

      // Mit Push-Abo zeigt der Service Worker die Benachrichtigung; sonst hier im offenen Tab.
      if (browserSupported && !push.subscribed && document.visibilityState !== "visible") {
        let url: string | undefined;
        try {
          url = new URL(actionUrl?.trim() || "/mitglieder", window.location.origin).toString();
        } catch {
          url = undefined;
        }
        void showNotification({ title, body: description, tag: id, ...(url ? { url } : {}) });
      }
    },
    [browserSupported, push.subscribed, showNotification],
  );
  useNotificationRealtime(handleRealtime);

  const enableDeviceNotifications = useCallback(async () => {
    try {
      const result =
        push.supported && push.configured ? await push.enable() : await requestPermission();
      if (result === "subscribed" || result === "granted")
        toast.success("Benachrichtigungen auf diesem Gerät aktiviert", { duration: 3000 });
      else if (result === "denied")
        toast.error(
          "Benachrichtigungen sind blockiert. Bitte in den Browser-Einstellungen erlauben.",
          {
            duration: 5000,
          },
        );
    } catch (error) {
      console.error("[NotificationBell] enabling push failed", error);
      toast.error("Benachrichtigungen konnten nicht aktiviert werden.", { duration: 5000 });
    }
  }, [push, requestPermission]);

  const pushMissing =
    push.supported && push.configured && !push.subscribed && push.permission !== "denied";
  const showDeviceHint =
    inbox.loaded &&
    !push.loading &&
    !inbox.hints?.deviceNotificationsDismissed &&
    (pushMissing || (browserSupported && !push.configured && browserPermission === "default"));

  // Zähler am App-Symbol (installierte App, sofern der Browser das kann).
  useEffect(() => {
    if (!authenticated || !inbox.loaded || !("setAppBadge" in navigator)) return;
    const badge = openCount > 0 ? navigator.setAppBadge(openCount) : navigator.clearAppBadge();
    badge.catch(() => undefined);
  }, [authenticated, inbox.loaded, openCount]);

  const markAllRead = useCallback(() => {
    void update("read", { all: true });
    seenNew.current = [];
  }, [update]);

  const close = useCallback(() => handleOpenChange(false), [handleOpenChange]);

  const content = useMemo(
    () => (
      <div className="space-y-3" onKeyDown={onKeyDown}>
        <CategoryChips value={category} onChange={setCategory} counts={counts} className="px-3" />
        <NotificationSections
          groups={groups}
          update={update}
          onNavigate={close}
          limits={PANEL_LIMITS}
          empty={
            inbox.loaded ? (
              <>
                <BellIcon className="mx-auto mb-2 h-6 w-6 opacity-50" />
                Alles erledigt – keine Benachrichtigungen.
              </>
            ) : (
              "Lade…"
            )
          }
        />
      </div>
    ),
    [category, close, counts, groups, inbox.loaded, onKeyDown, update],
  );

  const footer = (
    <div className="space-y-2">
      {showDeviceHint ? (
        <DismissibleNotice
          noticeKey="device-notifications"
          tone="primary"
          icon={<BellRingIcon />}
          title="Auch ohne offenen Tab informiert werden?"
          action={
            <Button size="sm" onClick={() => void enableDeviceNotifications()}>
              Erlauben
            </Button>
          }
        />
      ) : null}
      <Link
        href="/mitglieder/benachrichtigungen"
        onClick={close}
        className="block rounded-md py-2 text-center text-sm font-medium text-primary hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Alle anzeigen
      </Link>
    </div>
  );

  const headerActions = (
    <div className="flex items-center gap-1">
      {openCount > 0 ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={markAllRead}
          className="h-8 gap-1.5 px-2 text-xs"
        >
          <CheckCheckIcon className="h-3.5 w-3.5" />
          Alle gelesen
        </Button>
      ) : null}
      <Button asChild size="sm" variant="ghost" className="h-8 w-8 p-0">
        <Link
          href="/mitglieder/profil?bereich=benachrichtigungen"
          onClick={close}
          aria-label="Einstellungen für Benachrichtigungen"
          title="Einstellungen"
        >
          <SettingsIcon className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );

  if (status === "loading") {
    return <Skeleton className={cn(className, "h-9 w-9 rounded-full")} aria-hidden />;
  }
  if (!session?.user) return null;

  const trigger = (
    <button
      type="button"
      onClick={isDesktop ? undefined : () => handleOpenChange(!open)}
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-card/70 text-foreground/80 transition hover:bg-accent/30 focus:outline-none focus:ring-2 focus:ring-ring",
        className,
      )}
      aria-label={
        openCount
          ? `Benachrichtigungen, ${openCount} offen${urgent ? ", dringend" : ""}`
          : "Benachrichtigungen"
      }
      data-testid="notification-bell"
    >
      {urgent ? (
        <BellRingIcon className="h-[18px] w-[18px]" />
      ) : (
        <BellIcon className="h-[18px] w-[18px]" />
      )}
      {openCount > 0 ? (
        <span
          className={cn(
            "absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[0.6rem] font-semibold tabular-nums",
            urgent
              ? "bg-destructive text-destructive-foreground"
              : "bg-primary text-primary-foreground",
          )}
          aria-hidden
        >
          {openCount > 99 ? "99+" : openCount}
        </span>
      ) : null}
    </button>
  );

  if (!isDesktop) {
    return (
      <>
        {trigger}
        <BottomSheet
          open={open}
          onOpenChange={handleOpenChange}
          title="Benachrichtigungen"
          description="Was zu tun ist und was neu ist"
          headerAction={headerActions}
          footer={footer}
          className="h-[85dvh]"
        >
          <div className="-mx-3">{content}</div>
        </BottomSheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="flex max-h-[min(80vh,40rem)] w-[26rem] max-w-[calc(100vw-1.5rem)] flex-col p-0"
        aria-label="Benachrichtigungen"
      >
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
          <h2 className="text-sm font-semibold">Benachrichtigungen</h2>
          {headerActions}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-3">{content}</div>
        <div className="border-t border-border/60 p-2">{footer}</div>
      </PopoverContent>
    </Popover>
  );
}
