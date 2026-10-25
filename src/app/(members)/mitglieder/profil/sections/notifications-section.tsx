"use client";

import * as React from "react";
import { toast } from "sonner";

import { AsyncButton } from "@/components/ui/async-button";
import { BellRingIcon, ShareIcon, SmartphoneIcon, TrashIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { TimeInput } from "@/components/ui/time-input";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { formatNotificationTime } from "@/lib/notifications/format";
import {
  CATEGORIES_WITH_ACTIONS,
  EVENT_REMINDER_LEAD_OPTIONS,
  minutesToTime,
  resolveReminderLead,
  timeToMinutes,
  type DigestMode,
  type EmailMode,
  type EventReminderLead,
  type QuietHours,
} from "@/lib/notifications/preferences";
import { usePwaInstall } from "@/lib/pwa/register-sw";

type Preferences = {
  pushConfigured: boolean;
  mailConfigured: boolean;
  email: string | null;
  digest: DigestMode;
  categories: PreferenceEntry[];
  /** Verwaltungs-Themen, für die man zuständig ist (Fotoerlaubnisse, Auslagen, Lager). */
  adminTopics: PreferenceEntry[];
  quietHours: QuietHours | null;
  reminderLead: EventReminderLead;
};

type PreferenceEntry = {
  /** Bereich (`proben`) oder Verwaltungs-Thema (`verwaltung:fotoerlaubnisse`). */
  key: string;
  label: string;
  description: string;
  push: boolean;
  emailMode: EmailMode;
  actionEmail: boolean;
};

type Device = {
  id: string;
  endpoint: string;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};

const EMAIL_MODE_OPTIONS: { value: EmailMode; label: string }[] = [
  { value: "instant", label: "Sofort" },
  { value: "digest", label: "Sammeln" },
  { value: "off", label: "Aus" },
];

const DIGEST_OPTIONS: { value: DigestMode; label: string }[] = [
  { value: "daily", label: "Täglich um 18 Uhr" },
  { value: "weekly", label: "Montags um 18 Uhr" },
  { value: "off", label: "Nie" },
];

const DEFAULT_QUIET: QuietHours = { start: 22 * 60, end: 7 * 60 };

async function savePreference(body: unknown) {
  const response = await fetch("/api/notifications/preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

/** Profil-Bereich „Benachrichtigungen“: dieses Gerät, Push und E-Mail je Bereich, Ruhezeit, Geräte. */
export function NotificationsSection() {
  const push = usePushSubscription();
  const install = usePwaInstall();
  const [preferences, setPreferences] = React.useState<Preferences | null>(null);
  const [devices, setDevices] = React.useState<Device[]>([]);
  const [currentEndpoint, setCurrentEndpoint] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<string | null>(null);
  const [removeDevice, setRemoveDevice] = React.useState<Device | null>(null);

  const load = React.useCallback(async () => {
    try {
      const [prefResponse, deviceResponse] = await Promise.all([
        fetch("/api/notifications/preferences", { cache: "no-store" }),
        fetch("/api/push/subscription", { cache: "no-store" }),
      ]);
      if (!prefResponse.ok || !deviceResponse.ok) throw new Error("load failed");
      setPreferences((await prefResponse.json()) as Preferences);
      setDevices(((await deviceResponse.json()) as { devices: Device[] }).devices);
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager?.getSubscription();
        setCurrentEndpoint(subscription?.endpoint ?? null);
      }
    } catch (error) {
      console.error("[NotificationsSection] load failed", error);
      toast.error("Einstellungen konnten nicht geladen werden.", { duration: 5000 });
    }
  }, []);

  React.useEffect(() => {
    // Einstellungen erst im Browser laden (Geräte-Abo gibt es nur dort).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const run = async (key: string, action: () => Promise<void>, success?: string) => {
    setPending(key);
    try {
      await action();
      if (success) toast.success(success, { duration: 3000 });
    } catch (error) {
      console.error("[NotificationsSection]", key, error);
      toast.error("Das hat nicht geklappt.", { duration: 5000 });
    } finally {
      setPending(null);
    }
  };

  const updateEntry = (key: string, patch: Partial<PreferenceEntry>) => {
    const apply = (entries: PreferenceEntry[]) =>
      entries.map((entry) => (entry.key === key ? { ...entry, ...patch } : entry));
    setPreferences((prev) =>
      prev
        ? { ...prev, categories: apply(prev.categories), adminTopics: apply(prev.adminTopics) }
        : prev,
    );
    void savePreference({ category: key, ...patch }).catch((error) => {
      console.error("[NotificationsSection] save preference failed", error);
      toast.error("Konnte nicht gespeichert werden.", { duration: 5000 });
      void load();
    });
  };

  const setDigest = (value: string) => {
    const digest = (DIGEST_OPTIONS.find((option) => option.value === value)?.value ??
      "daily") as DigestMode;
    setPreferences((prev) => (prev ? { ...prev, digest } : prev));
    void savePreference({ digest }).catch((error) => {
      console.error("[NotificationsSection] save digest failed", error);
      toast.error("Zusammenfassung konnte nicht gespeichert werden.", { duration: 5000 });
      void load();
    });
  };

  const setQuietHours = (quietHours: QuietHours | null) => {
    setPreferences((prev) => (prev ? { ...prev, quietHours } : prev));
    void savePreference({ quietHours }).catch((error) => {
      console.error("[NotificationsSection] save quiet hours failed", error);
      toast.error("Ruhezeit konnte nicht gespeichert werden.", { duration: 5000 });
      void load();
    });
  };

  const setReminderLead = (value: string) => {
    const lead = resolveReminderLead(value);
    setPreferences((prev) => (prev ? { ...prev, reminderLead: lead } : prev));
    void savePreference({ reminderLead: lead }).catch((error) => {
      console.error("[NotificationsSection] save reminder lead failed", error);
      toast.error("Erinnerung konnte nicht gespeichert werden.", { duration: 5000 });
      void load();
    });
  };

  if (!preferences) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  const quiet = preferences.quietHours;

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/12 text-primary">
            <SmartphoneIcon />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="text-sm font-semibold text-foreground">Dieses Gerät</h3>
            <p className="text-sm text-muted-foreground">
              {!preferences.pushConfigured
                ? "Push ist auf diesem Server noch nicht eingerichtet."
                : !push.supported
                  ? install.iosManual
                    ? "Auf dem iPhone kommt Push nur in der installierten App."
                    : "Dieser Browser unterstützt keine Push-Benachrichtigungen."
                  : push.permission === "denied"
                    ? "Benachrichtigungen sind blockiert. Bitte in den Browser-Einstellungen erlauben."
                    : push.subscribed
                      ? "Push ist aktiv – auch wenn die App geschlossen ist."
                      : "Push ist aus. Einschalten, um auch ohne offene App informiert zu werden."}
            </p>
            {install.iosManual && !push.supported ? (
              <p className="text-xs text-muted-foreground">
                Unten auf <ShareIcon className="inline h-3.5 w-3.5 align-text-bottom" /> „Teilen“
                tippen, dann „Zum Home-Bildschirm“ – und die App von dort öffnen.
              </p>
            ) : null}
          </div>
        </div>
        {preferences.pushConfigured && push.supported && push.permission !== "denied" ? (
          <div className="flex flex-wrap gap-2 pl-12">
            {push.subscribed ? (
              <>
                <AsyncButton
                  size="sm"
                  variant="outline"
                  isLoading={pending === "test"}
                  loadingText="Sende…"
                  onClick={() =>
                    void run(
                      "test",
                      async () => {
                        const response = await fetch("/api/push/test", { method: "POST" });
                        if (!response.ok) throw new Error(`HTTP ${response.status}`);
                      },
                      "Test gesendet – schließe die App, um ihn zu sehen.",
                    )
                  }
                >
                  <BellRingIcon className="h-4 w-4" />
                  Test senden
                </AsyncButton>
                <AsyncButton
                  size="sm"
                  variant="ghost"
                  isLoading={pending === "disable"}
                  loadingText="Schalte aus…"
                  onClick={() =>
                    void run(
                      "disable",
                      async () => {
                        await push.disable();
                        await load();
                      },
                      "Push auf diesem Gerät ausgeschaltet",
                    )
                  }
                >
                  Ausschalten
                </AsyncButton>
              </>
            ) : (
              <AsyncButton
                size="sm"
                isLoading={pending === "enable"}
                loadingText="Schalte ein…"
                onClick={() =>
                  void run("enable", async () => {
                    const result = await push.enable();
                    if (result === "denied") throw new Error("denied");
                    await load();
                    if (result === "subscribed")
                      toast.success("Push auf diesem Gerät aktiv", { duration: 3000 });
                  })
                }
              >
                Push einschalten
              </AsyncButton>
            )}
          </div>
        ) : null}
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-foreground">Push für</h3>
        <p className="mb-2 text-sm text-muted-foreground">
          Aufgaben (z. B. Anfragen) und Dringendes wie kurzfristige Absagen kommen immer. Hier
          wählst du, ob auch die übrigen Hinweise eines Bereichs aufs Handy kommen. In der Glocke
          steht immer alles.
        </p>
        <ul className="divide-y divide-border/60">
          {preferences.categories.map(({ key, label, description, push: enabled }) => {
            const id = `push-category-${key}`;
            return (
              <li key={key} className="flex min-h-12 items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <label htmlFor={id} className="text-sm font-medium text-foreground">
                    {label}
                  </label>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <Switch
                  id={id}
                  checked={enabled}
                  onCheckedChange={(value) => updateEntry(key, { push: value })}
                />
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-foreground">E-Mail</h3>
        <p className="mb-2 text-sm text-muted-foreground">
          {!preferences.email
            ? "In deinem Profil ist keine E-Mail-Adresse hinterlegt."
            : !preferences.mailConfigured
              ? "Der Mailversand ist gerade nicht eingerichtet – deine Auswahl gilt, sobald er läuft."
              : `An ${preferences.email}. Dringendes kommt immer sofort. Sonst wählst du je Bereich: sofort, gesammelt in der Zusammenfassung oder gar nicht.`}
        </p>
        <ul className="divide-y divide-border/60">
          {preferences.categories.map((entry) => (
            <EmailRow
              key={entry.key}
              entry={entry}
              showActionSwitch={CATEGORIES_WITH_ACTIONS.some((category) => category === entry.key)}
              onChange={(patch) => updateEntry(entry.key, patch)}
            />
          ))}
        </ul>
        <div className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <label htmlFor="digest" className="text-sm font-medium text-foreground">
              Zusammenfassung
            </label>
            <p className="text-xs text-muted-foreground">
              Enthält nur, was du bis dahin nicht gelesen hast.
            </p>
          </div>
          <Select value={preferences.digest} onValueChange={setDigest}>
            <SelectTrigger id="digest" className="h-11 w-full sm:w-56" aria-label="Zusammenfassung">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIGEST_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {preferences.adminTopics.length ? (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-foreground">Verwaltung</h3>
          <p className="mb-2 text-sm text-muted-foreground">
            Hinweise zu dem, was du verwaltest. Sie gehen meist an mehrere – wer sich kümmert, hakt
            die Aufgabe für alle ab. Wer nur die Glocke nutzen möchte, schaltet die Mails hier aus.
          </p>
          <ul className="divide-y divide-border/60">
            {preferences.adminTopics.map((entry) => (
              <EmailRow
                key={entry.key}
                entry={entry}
                showDescription
                showPushSwitch
                showActionSwitch
                onChange={(patch) => updateEntry(entry.key, patch)}
              />
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="space-y-3 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <label htmlFor="reminder-lead" className="text-sm font-semibold text-foreground">
              Erinnerung vor Terminen
            </label>
            <p className="text-sm text-muted-foreground">
              Vor Proben und Terminen, für die du eingeteilt bist, erinnern wir dich rechtzeitig.
            </p>
          </div>
          <Select value={preferences.reminderLead} onValueChange={setReminderLead}>
            <SelectTrigger
              id="reminder-lead"
              className="h-11 w-full sm:w-56"
              aria-label="Erinnerung vorher"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_REMINDER_LEAD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="quiet-hours" className="text-sm font-semibold text-foreground">
              Ruhezeit
            </label>
            <p className="text-sm text-muted-foreground">
              Kein Push in dieser Zeit – außer Dringendem.
            </p>
          </div>
          <Switch
            id="quiet-hours"
            checked={Boolean(quiet)}
            onCheckedChange={(value) => setQuietHours(value ? DEFAULT_QUIET : null)}
          />
        </div>
        {quiet ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">von</span>
            <TimeInput
              aria-label="Ruhezeit Beginn"
              className="w-28"
              value={minutesToTime(quiet.start)}
              onChange={(event) => {
                const start = timeToMinutes(event.target.value);
                if (start !== null) setQuietHours({ ...quiet, start });
              }}
            />
            <span className="text-muted-foreground">bis</span>
            <TimeInput
              aria-label="Ruhezeit Ende"
              className="w-28"
              value={minutesToTime(quiet.end)}
              onChange={(event) => {
                const end = timeToMinutes(event.target.value);
                if (end !== null) setQuietHours({ ...quiet, end });
              }}
            />
            <span className="text-muted-foreground">Uhr</span>
          </div>
        ) : null}
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-foreground">Angemeldete Geräte</h3>
        {devices.length ? (
          <ul className="mt-2 divide-y divide-border/60">
            {devices.map((device) => (
              <li key={device.id} className="flex min-h-12 items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {device.label ?? "Gerät"}
                    {device.endpoint === currentEndpoint ? (
                      <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                        dieses Gerät
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {device.lastUsedAt
                      ? `Zuletzt benachrichtigt ${formatNotificationTime(device.lastUsedAt)}`
                      : `Angemeldet ${formatNotificationTime(device.createdAt)}`}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  aria-label={`${device.label ?? "Gerät"} entfernen`}
                  onClick={() => setRemoveDevice(device)}
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Noch kein Gerät für Push angemeldet.
          </p>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(removeDevice)}
        onOpenChange={(open) => (open ? undefined : setRemoveDevice(null))}
        title="Gerät entfernen?"
        description="Auf diesem Gerät kommen dann keine Push-Benachrichtigungen mehr an."
        confirmLabel="Entfernen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onCancel={() => setRemoveDevice(null)}
        onConfirm={() => {
          const device = removeDevice;
          setRemoveDevice(null);
          if (!device) return;
          void run(
            "remove",
            async () => {
              const response = await fetch("/api/push/subscription", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: device.id }),
              });
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              if (device.endpoint === currentEndpoint) await push.refresh();
              await load();
            },
            "Gerät entfernt",
          );
        }}
      />
    </div>
  );
}

/** Eine Zeile „E-Mail“: Modus für Hinweise, optional Aufgaben-Mail und Push. */
function EmailRow({
  entry,
  showDescription = false,
  showPushSwitch = false,
  showActionSwitch = false,
  onChange,
}: {
  entry: PreferenceEntry;
  showDescription?: boolean;
  showPushSwitch?: boolean;
  showActionSwitch?: boolean;
  onChange: (patch: Partial<PreferenceEntry>) => void;
}) {
  const actionId = `action-email-${entry.key}`;
  const pushId = `push-topic-${entry.key}`;
  return (
    <li className="space-y-2 py-2.5">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="min-w-0">
          <span className="text-sm font-medium text-foreground">{entry.label}</span>
          {showDescription ? (
            <p className="text-xs text-muted-foreground">{entry.description}</p>
          ) : null}
        </div>
        <SegmentedControl
          aria-label={`E-Mail für ${entry.label}`}
          value={entry.emailMode}
          onValueChange={(value) => onChange({ emailMode: value })}
          options={EMAIL_MODE_OPTIONS}
        />
      </div>
      {showActionSwitch ? (
        <div className="flex items-center gap-3">
          <label htmlFor={actionId} className="min-w-0 flex-1 text-xs text-muted-foreground">
            Aufgaben trotzdem sofort per Mail (z. B. „bitte prüfen“)
          </label>
          <Switch
            id={actionId}
            checked={entry.actionEmail}
            onCheckedChange={(value) => onChange({ actionEmail: value })}
          />
        </div>
      ) : null}
      {showPushSwitch ? (
        <div className="flex items-center gap-3">
          <label htmlFor={pushId} className="min-w-0 flex-1 text-xs text-muted-foreground">
            Übrige Hinweise per Push (Aufgaben kommen immer)
          </label>
          <Switch
            id={pushId}
            checked={entry.push}
            onCheckedChange={(value) => onChange({ push: value })}
          />
        </div>
      ) : null}
    </li>
  );
}
