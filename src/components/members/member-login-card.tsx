"use client";

import * as React from "react";
import { toast } from "sonner";

import { TrashIcon } from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { MemberLoginLinkDialog } from "@/components/members/member-login-link-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format/date";

type DeviceKind = "webauthn" | "totp";

type Device = {
  id: string;
  kind: DeviceKind;
  name: string;
  description: string | null;
  createdAt: string | null;
  lastUsedAt: string | null;
};

type LoginState =
  | { available: false }
  | {
      available: true;
      account: {
        username: string;
        active: boolean;
        managed: boolean;
        passwordChangedAt: string | null;
      } | null;
      devices: Device[];
    };

type PendingConfirm =
  | { type: "device"; device: Device }
  | { type: "reset-totp" }
  | { type: "reset-passkeys" }
  | { type: "password-email" }
  | { type: "login-link" };

export interface MemberLoginCardProps {
  userId: string;
  displayName: string;
  hasEmail: boolean;
}

/**
 * Mitgliederverwaltung: Anmeldung über das Theater-Konto (Authentik) eines
 * Mitglieds – Passkeys/Authenticator-Apps entfernen, Zwei-Faktor zurücksetzen,
 * Mail "Passwort festlegen" schicken. Dieselben Daten sieht das Mitglied im
 * Profil unter "Anmeldung & Sicherheit".
 */
export function MemberLoginCard({ userId, displayName, hasEmail }: MemberLoginCardProps) {
  const [state, setState] = React.useState<LoginState | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [confirm, setConfirm] = React.useState<PendingConfirm | null>(null);
  const [pending, setPending] = React.useState(false);
  const [loginLink, setLoginLink] = React.useState<{ link: string; expiresAt: string } | null>(
    null,
  );

  const load = React.useCallback(async () => {
    try {
      const response = await fetch(`/api/members/${userId}/login`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setState((await response.json()) as LoginState);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [userId]);

  React.useEffect(() => {
    // Daten liegen in Authentik und werden erst im Browser geladen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const run = async (request: () => Promise<Response>, success: string) => {
    setPending(true);
    try {
      const response = await request();
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? `HTTP ${response.status}`);
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Das hat nicht geklappt.");
    } finally {
      setPending(false);
      await load();
    }
  };

  const removeDevices = (kind: DeviceKind, id?: string) =>
    fetch(`/api/members/${userId}/login`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id }),
    });

  const createLoginLink = async () => {
    setPending(true);
    try {
      const response = await fetch(`/api/members/${userId}/login/link`, { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        link?: string;
        expiresAt?: string;
      };
      if (!response.ok || !payload.link || !payload.expiresAt) {
        throw new Error(payload.error ?? `HTTP ${response.status}`);
      }
      setLoginLink({ link: payload.link, expiresAt: payload.expiresAt });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Das hat nicht geklappt.");
    } finally {
      setPending(false);
      await load();
    }
  };

  const onConfirm = () => {
    const action = confirm;
    setConfirm(null);
    if (!action) return;
    if (action.type === "device") {
      void run(
        () => removeDevices(action.device.kind, action.device.id),
        `${action.device.name} entfernt`,
      );
    } else if (action.type === "reset-totp") {
      void run(() => removeDevices("totp"), "Zwei-Faktor-Anmeldung zurückgesetzt");
    } else if (action.type === "reset-passkeys") {
      void run(() => removeDevices("webauthn"), "Alle Passkeys entfernt");
    } else if (action.type === "login-link") {
      void createLoginLink();
    } else {
      void run(
        () => fetch(`/api/members/${userId}/login`, { method: "POST" }),
        `Mail „Passwort festlegen“ an ${displayName} verschickt`,
      );
    }
  };

  const confirmTexts: Record<PendingConfirm["type"], { title: string; description: string }> = {
    device: {
      title: "Gerät entfernen?",
      description: `${displayName} kann sich damit nicht mehr anmelden.`,
    },
    "reset-totp": {
      title: "Zwei-Faktor zurücksetzen?",
      description: `Alle Authenticator-Apps von ${displayName} werden entfernt. Danach reicht beim Login wieder das Passwort; ${displayName} kann im Profil eine neue App einrichten.`,
    },
    "reset-passkeys": {
      title: "Alle Passkeys entfernen?",
      description: `${displayName} meldet sich danach mit Passwort an und kann im Profil neue Passkeys hinzufügen.`,
    },
    "login-link": {
      title: "Anmeldelink erzeugen?",
      description: `Der Link gilt 30 Minuten und einmal. ${displayName} richtet damit einen Passkey (Fingerabdruck/Gesicht) statt eines Passworts ein. Für Konten ohne Passwort, z. B. die Regie, oder wenn der Passkey verloren ist.`,
    },
    "password-email": {
      title: "Passwort-Mail schicken?",
      description: `${displayName} bekommt eine Mail mit einem Link (2 Stunden gültig), um ein neues Passwort festzulegen. Das alte Passwort gilt bis dahin weiter.`,
    },
  };

  const renderBody = () => {
    if (failed) {
      return (
        <p className="text-sm text-muted-foreground">
          Konnte nicht geladen werden.{" "}
          <Button variant="link" className="h-auto p-0" onClick={() => void load()}>
            Erneut versuchen
          </Button>
        </p>
      );
    }
    if (!state) return <Skeleton className="h-24 w-full" />;
    if (!state.available) {
      return (
        <p className="text-sm text-muted-foreground">
          Theater-Konten sind in dieser Umgebung nicht verwaltbar (kein Zugriff auf Authentik).
        </p>
      );
    }

    const { account, devices } = state;
    const passkeys = devices.filter((device) => device.kind === "webauthn");
    const totps = devices.filter((device) => device.kind === "totp");
    const canManage = Boolean(account?.managed);
    const passwordChanged = formatDate(account?.passwordChangedAt ?? null, "medium");

    const deviceList = (items: Device[], empty: string) =>
      items.length ? (
        <ul className="divide-y divide-border/60">
          {items.map((device) => {
            const used = formatDate(device.lastUsedAt, "medium");
            const created = formatDate(device.createdAt, "medium");
            return (
              <li key={device.id} className="flex min-h-11 items-center gap-3 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{device.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {used
                      ? `zuletzt genutzt ${used}`
                      : created
                        ? `hinzugefügt ${created}`
                        : "noch nicht genutzt"}
                  </p>
                </div>
                {canManage ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`${device.name} entfernen`}
                    disabled={pending}
                    onClick={() => setConfirm({ type: "device", device })}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      );

    return (
      <div className="space-y-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Theater-Konto</dt>
            <dd className="flex flex-wrap items-center gap-2 font-medium text-foreground">
              {account ? account.username : "noch nicht angelegt"}
              {account && !account.active ? <Badge variant="outline">deaktiviert</Badge> : null}
              {account && !account.managed ? (
                <Badge variant="outline">in Authentik verwaltet</Badge>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Passwort</dt>
            <dd className="font-medium text-foreground">
              {passwordChanged ? `zuletzt geändert ${passwordChanged}` : "keins gesetzt"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Zwei-Faktor (Authenticator-App)</dt>
            <dd className="font-medium text-foreground">{totps.length ? "aktiv" : "aus"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Passkeys</dt>
            <dd className="font-medium text-foreground">{passkeys.length}</dd>
          </div>
        </dl>

        {account ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground">Passkeys</h4>
              {deviceList(passkeys, "Keine Passkeys.")}
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground">Authenticator-Apps</h4>
              {deviceList(totps, "Keine Authenticator-App.")}
            </div>
          </div>
        ) : null}

        {account && !canManage ? (
          <p className="text-xs text-muted-foreground">
            Dieses Konto stammt nicht aus dem Mitgliederbereich (z. B. Admin-Konto) und wird direkt
            in Authentik verwaltet.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <AsyncButton
            size="sm"
            variant="outline"
            isLoading={pending && confirm === null}
            disabled={!hasEmail || pending || (account !== null && !canManage)}
            onClick={() => setConfirm({ type: "password-email" })}
          >
            Mail „Passwort festlegen“
          </AsyncButton>
          <Button
            size="sm"
            variant="outline"
            disabled={!hasEmail || pending || (account !== null && !canManage)}
            onClick={() => setConfirm({ type: "login-link" })}
          >
            Anmeldelink (Passkey)
          </Button>
          {canManage && totps.length ? (
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => setConfirm({ type: "reset-totp" })}
            >
              Zwei-Faktor zurücksetzen
            </Button>
          ) : null}
          {canManage && passkeys.length > 1 ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirm({ type: "reset-passkeys" })}
            >
              Alle Passkeys entfernen
            </Button>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <Card className="border border-border/70">
      <CardHeader className="space-y-1.5">
        <CardTitle>Anmeldung</CardTitle>
        <p className="text-sm text-muted-foreground">
          Theater-Konto von {displayName}: Passwort, Passkeys und Zwei-Faktor-Anmeldung. Hilft, wenn
          jemand das Handy verloren hat oder nicht mehr reinkommt.
        </p>
      </CardHeader>
      <CardContent>{renderBody()}</CardContent>
      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => (open ? undefined : setConfirm(null))}
        title={confirm ? confirmTexts[confirm.type].title : ""}
        description={confirm ? confirmTexts[confirm.type].description : ""}
        confirmLabel={
          confirm?.type === "password-email"
            ? "Mail schicken"
            : confirm?.type === "login-link"
              ? "Link erzeugen"
              : "Entfernen"
        }
        cancelLabel="Abbrechen"
        variant={
          confirm?.type === "password-email" || confirm?.type === "login-link"
            ? "default"
            : "destructive"
        }
        onCancel={() => setConfirm(null)}
        onConfirm={onConfirm}
      />
      {loginLink ? (
        <MemberLoginLinkDialog
          link={loginLink.link}
          expiresAt={loginLink.expiresAt}
          displayName={displayName}
          onClose={() => setLoginLink(null)}
        />
      ) : null}
    </Card>
  );
}
