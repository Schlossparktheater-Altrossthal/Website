"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale/de";
import QRCode from "qrcode";
import { toast } from "sonner";

import {
  CalendarIcon,
  CopyIcon,
  ExternalLinkIcon,
  RefreshIcon,
  TrashIcon,
} from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useMediaQuery } from "@/hooks/useMediaQuery";

type Feed = { url: string; includeBlockedDays: boolean; lastAccessedAt: string | null };

const TITLE = "Kalender abonnieren";
const DESCRIPTION =
  "Deine Proben und Termine erscheinen automatisch in deiner Kalender-App und bleiben aktuell.";

async function request(method: "GET" | "POST" | "PATCH" | "DELETE", body?: unknown) {
  const response = await fetch("/api/calendar/feed", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as Feed | null;
}

function webcalUrl(url: string) {
  return url.replace(/^https?:\/\//, "webcal://");
}

function googleUrl(url: string) {
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl(url))}`;
}

function FeedPanel({ showQr }: { showQr: boolean }) {
  const [feed, setFeed] = useState<Feed | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<"renew" | "disable" | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    request("GET")
      .then((result) => active && setFeed(result))
      .catch(() => {
        if (!active) return;
        setFeed(null);
        toast.error("Kalender-Link konnte nicht geladen werden.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!showQr || !feed) return;
    let active = true;
    QRCode.toDataURL(webcalUrl(feed.url), { margin: 1, width: 176 })
      .then((data) => active && setQr(data))
      .catch(() => active && setQr(null));
    return () => {
      active = false;
    };
  }, [showQr, feed]);

  const run = async (
    method: "POST" | "PATCH" | "DELETE",
    body: unknown,
    success: string,
    failure: string,
  ) => {
    setBusy(true);
    try {
      setFeed(await request(method, body));
      toast.success(success);
    } catch {
      toast.error(failure);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!feed) return;
    try {
      await navigator.clipboard.writeText(feed.url);
      toast.success("Link kopiert");
    } catch {
      toast.error("Kopieren nicht möglich – bitte den Link markieren.");
    }
  };

  if (feed === undefined) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!feed) {
    return (
      <div className="space-y-4">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Proben, zu denen du eingeladen bist – auch Absagen</li>
          <li>Termine deiner Produktionen und allgemeine Termine</li>
          <li>Termine deiner Gewerke</li>
          <li>auf Wunsch deine eigenen Sperren</li>
        </ul>
        <AsyncButton
          type="button"
          className="w-full"
          isLoading={busy}
          loadingText="Wird erstellt …"
          onClick={() =>
            void run(
              "POST",
              undefined,
              "Kalender-Link erstellt",
              "Link konnte nicht erstellt werden.",
            )
          }
        >
          <CalendarIcon className="h-4 w-4" aria-hidden />
          Kalender-Link erstellen
        </AsyncButton>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-2">
        <Button asChild>
          <a href={webcalUrl(feed.url)}>
            <CalendarIcon className="h-4 w-4" aria-hidden />
            In Kalender-App öffnen
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={googleUrl(feed.url)} target="_blank" rel="noopener noreferrer">
            <ExternalLinkIcon className="h-4 w-4" aria-hidden />
            Google Kalender
          </a>
        </Button>
      </div>

      <div className="space-y-2">
        <label htmlFor="calendar-feed-url" className="text-sm font-medium">
          Abo-Link
        </label>
        <div className="flex gap-2">
          <input
            id="calendar-feed-url"
            readOnly
            value={feed.url}
            onFocus={(event) => event.currentTarget.select()}
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
          />
          <Button type="button" variant="outline" onClick={copy} aria-label="Link kopieren">
            <CopyIcon className="h-4 w-4" aria-hidden />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Wer den Link kennt, sieht deine Termine – bitte nicht weitergeben. Google aktualisiert
          Abos nur alle paar Stunden, Apple und Outlook deutlich öfter.
        </p>
      </div>

      {showQr && qr ? (
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- Data-URL, keine Optimierung nötig */}
          <img src={qr} alt="QR-Code zum Abo-Link" className="h-28 w-28 rounded-md" />
          <p className="text-sm text-muted-foreground">
            Mit dem Handy scannen, um den Kalender dort zu abonnieren.
          </p>
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-4 rounded-lg border border-border/60 p-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Eigene Sperren anzeigen</p>
          <p className="text-xs text-muted-foreground">
            Als ganztägige Einträge, die deine Zeit nicht als belegt markieren.
          </p>
        </div>
        <Switch
          checked={feed.includeBlockedDays}
          disabled={busy}
          aria-label="Eigene Sperren anzeigen"
          onCheckedChange={(checked) =>
            void run(
              "PATCH",
              { includeBlockedDays: checked },
              checked ? "Sperren werden angezeigt" : "Sperren werden ausgeblendet",
              "Einstellung konnte nicht gespeichert werden.",
            )
          }
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4">
        <p className="text-xs text-muted-foreground">
          {feed.lastAccessedAt
            ? `Zuletzt abgerufen ${formatDistanceToNow(new Date(feed.lastAccessedAt), { addSuffix: true, locale: de })}`
            : "Noch nicht abgerufen"}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => setConfirm("renew")}
          >
            <RefreshIcon className="h-4 w-4" aria-hidden />
            Neuer Link
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={() => setConfirm("disable")}
          >
            <TrashIcon className="h-4 w-4" aria-hidden />
            Abschalten
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm === "disable" ? "Kalender-Link abschalten?" : "Neuen Link erzeugen?"}
        description={
          confirm === "disable"
            ? "Abonnierte Kalender erhalten keine Termine mehr."
            : "Der bisherige Link funktioniert danach nicht mehr – du musst den Kalender neu abonnieren."
        }
        confirmLabel={confirm === "disable" ? "Abschalten" : "Neuen Link erzeugen"}
        cancelLabel="Abbrechen"
        variant="destructive"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const action = confirm;
          setConfirm(null);
          if (action === "disable") {
            void run(
              "DELETE",
              undefined,
              "Kalender-Link abgeschaltet",
              "Link konnte nicht abgeschaltet werden.",
            );
          } else {
            void run("POST", undefined, "Neuer Link erzeugt", "Link konnte nicht erneuert werden.");
          }
        }}
      />
    </div>
  );
}

/** Persönlicher Kalender-Abo-Link (webcal/ICS) für die eigenen Termine. */
export function CalendarFeedDialog() {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 640px)");

  const trigger = (
    <Button variant="outline" size="sm" aria-label={TITLE} onClick={() => setOpen(true)}>
      <CalendarIcon className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Abonnieren</span>
    </Button>
  );

  if (isDesktop) {
    return (
      <>
        {trigger}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{TITLE}</DialogTitle>
              <DialogDescription>{DESCRIPTION}</DialogDescription>
            </DialogHeader>
            {open ? <FeedPanel showQr /> : null}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      {trigger}
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title={TITLE}
        description={DESCRIPTION}
        showDescription
      >
        {open ? <FeedPanel showQr={false} /> : null}
      </BottomSheet>
    </>
  );
}
