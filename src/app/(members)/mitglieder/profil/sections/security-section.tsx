"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  ExternalLinkIcon,
  LockIcon,
  PlusIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  TrashIcon,
} from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";

type DeviceKind = "webauthn" | "totp";

type Device = {
  id: string;
  kind: DeviceKind;
  name: string;
  description: string | null;
  createdAt: string | null;
  lastUsedAt: string | null;
};

type SecurityState =
  | { mode: "local" }
  | {
      mode: "authentik";
      links: { passwordChange: string; passkeySetup: string; totpSetup: string; settings: string };
      /** `null`: Geräte hier nicht abrufbar (z. B. Staging) – dann zeigt Authentik sie. */
      devices: Device[] | null;
      canManage: boolean;
    };

const dateFormat = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeZone: DEFAULT_TIME_ZONE,
});

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : dateFormat.format(date);
}

/** Authentik-Flow mit Rücksprung in diesen Profilbereich. */
function withReturn(url: string) {
  if (typeof window === "undefined") return url;
  const back = `${window.location.origin}/mitglieder/profil?bereich=sicherheit`;
  return `${url}?next=${encodeURIComponent(back)}`;
}

function DeviceList({
  devices,
  canManage,
  empty,
  onRemove,
}: {
  devices: Device[];
  canManage: boolean;
  empty: string;
  onRemove: (device: Device) => void;
}) {
  if (!devices.length) {
    return <p className="py-3 text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="divide-y divide-border/60">
      {devices.map((device) => {
        const used = formatDate(device.lastUsedAt);
        const created = formatDate(device.createdAt);
        const meta = [
          device.description,
          used ? `zuletzt genutzt ${used}` : created ? `hinzugefügt ${created}` : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <li key={`${device.kind}-${device.id}`} className="flex min-h-12 items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{device.name}</p>
              {meta ? <p className="text-xs text-muted-foreground">{meta}</p> : null}
            </div>
            {canManage ? (
              <Button
                size="sm"
                variant="destructive"
                aria-label={`${device.name} entfernen`}
                onClick={() => onRemove(device)}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Profil-Bereich „Anmeldung & Sicherheit“. Passwort, Passkeys und
 * Authenticator-App gehören zum Theater-Konto (Authentik); die Knöpfe öffnen
 * die Theater-Flows dort und führen danach hierher zurück.
 */
export function SecuritySection() {
  const [state, setState] = React.useState<SecurityState | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [removeDevice, setRemoveDevice] = React.useState<Device | null>(null);

  const load = React.useCallback(async () => {
    try {
      const response = await fetch("/api/profile/security", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setState((await response.json()) as SecurityState);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  React.useEffect(() => {
    // Geräte liegen in Authentik und werden erst im Browser geladen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (failed) {
    return (
      <Card className="p-4 text-sm text-muted-foreground">
        Die Anmeldeeinstellungen konnten nicht geladen werden.{" "}
        <Button variant="link" className="h-auto p-0" onClick={() => void load()}>
          Erneut versuchen
        </Button>
      </Card>
    );
  }

  if (!state) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    );
  }

  if (state.mode === "local") {
    return (
      <Card className="p-4 text-sm text-muted-foreground">
        Hier gibt es nur die Anmeldung mit Passwort. Dein Passwort änderst du unter „Persönliche
        Daten“.
      </Card>
    );
  }

  const { links, devices, canManage } = state;
  const passkeys = devices?.filter((device) => device.kind === "webauthn") ?? [];
  const totps = devices?.filter((device) => device.kind === "totp") ?? [];
  const totpActive = totps.length > 0;

  const remove = async (device: Device) => {
    try {
      const response = await fetch("/api/profile/security", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: device.kind, id: device.id }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      toast.success(device.kind === "totp" ? "Authenticator-App entfernt" : "Passkey entfernt", {
        duration: 3000,
      });
    } catch {
      toast.error("Entfernen hat nicht geklappt. Bitte später noch einmal versuchen.");
    }
    await load();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Du meldest dich mit deinem Theater-Konto an. Es gilt für den Mitgliederbereich und die
        anderen Dienste des Sommertheaters (z. B. Nextcloud).
      </p>

      <Card className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <LockIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground">Passwort</h3>
            <p className="text-sm text-muted-foreground">
              Mindestens 8 Zeichen, keine Passwörter aus bekannten Datenlecks.
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={withReturn(links.passwordChange)}>Passwort ändern</a>
        </Button>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheckIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-foreground">Passkeys</h3>
            <p className="text-sm text-muted-foreground">
              Anmelden ohne Passwort – mit Fingerabdruck, Gesicht, Geräte-PIN oder einem
              Sicherheitsschlüssel. Beim Login „Mit Passkey anmelden“ wählen.
            </p>
          </div>
        </div>
        {devices ? (
          <DeviceList
            devices={passkeys}
            canManage={canManage}
            empty="Noch kein Passkey hinterlegt."
            onRemove={setRemoveDevice}
          />
        ) : null}
        <Button asChild size="sm">
          <a href={withReturn(links.passkeySetup)}>
            <PlusIcon className="h-4 w-4" />
            Passkey hinzufügen
          </a>
        </Button>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <SmartphoneIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
              Zwei-Faktor-Anmeldung
              {devices ? (
                <span
                  className={
                    totpActive
                      ? "rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary"
                      : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                  }
                >
                  {totpActive ? "aktiv" : "aus"}
                </span>
              ) : null}
            </h3>
            <p className="text-sm text-muted-foreground">
              Freiwillig: Mit einer Authenticator-App (z. B. Google Authenticator, Aegis, 1Password)
              fragt die Anmeldung nach dem Passwort zusätzlich einen 6-stelligen Code ab. Mit
              Passkey ist kein Code nötig.
            </p>
          </div>
        </div>
        {devices ? (
          <DeviceList
            devices={totps}
            canManage={canManage}
            empty="Keine Authenticator-App eingerichtet."
            onRemove={setRemoveDevice}
          />
        ) : null}
        <Button asChild size="sm" variant={totpActive ? "outline" : "default"}>
          <a href={withReturn(links.totpSetup)}>
            <PlusIcon className="h-4 w-4" />
            {totpActive ? "Weitere App einrichten" : "Authenticator-App einrichten"}
          </a>
        </Button>
      </Card>

      <Card className="space-y-2 p-4 text-sm text-muted-foreground">
        <p>
          {devices && canManage
            ? "Dieselben Einstellungen findest du auch direkt in deinem Theater-Konto."
            : "Deine hinterlegten Passkeys und Apps siehst und entfernst du in den Einstellungen deines Theater-Kontos."}
        </p>
        <Button asChild variant="outline" size="sm">
          <a href={links.settings} target="_blank" rel="noreferrer">
            <ExternalLinkIcon className="h-4 w-4" />
            Konto-Einstellungen öffnen
          </a>
        </Button>
      </Card>

      <ConfirmDialog
        open={Boolean(removeDevice)}
        onOpenChange={(open) => (open ? undefined : setRemoveDevice(null))}
        title={
          removeDevice?.kind === "totp" ? "Authenticator-App entfernen?" : "Passkey entfernen?"
        }
        description={
          removeDevice?.kind === "totp"
            ? "Ohne App fragt die Anmeldung nach dem Passwort keinen Code mehr ab."
            : "Mit diesem Passkey kannst du dich dann nicht mehr anmelden."
        }
        confirmLabel="Entfernen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onCancel={() => setRemoveDevice(null)}
        onConfirm={() => {
          const device = removeDevice;
          setRemoveDevice(null);
          if (device) void remove(device);
        }}
      />
    </div>
  );
}
