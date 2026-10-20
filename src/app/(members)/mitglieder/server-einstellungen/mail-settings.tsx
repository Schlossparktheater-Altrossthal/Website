"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  LockIcon,
  MailIcon,
  RefreshIcon,
} from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListRow } from "@/components/ui/list-row";
import { PasswordInput } from "@/components/ui/password-input";
import { SectionHeader } from "@/components/ui/section-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatTile } from "@/components/ui/stat-tile";
import { Switch } from "@/components/ui/switch";
import type { MailConfigSource, MailSenderField } from "@/lib/email/config";
import type { FieldErrors } from "@/lib/email/settings-validation";
import { formatRelativeFromNow } from "@/lib/datetime";
import { cn } from "@/lib/utils";

import {
  autoDetectMailServerSettingsAction,
  retryMailAction,
  saveServerSettingsAction,
  sendTestMailAction,
  testMailServerConnectionAction,
} from "./actions";

type FormValues = {
  mailHost: string;
  mailPort: string;
  mailSecure: boolean;
  mailUsername: string;
  mailFromAddress: string;
  mailFromName: string;
  mailReplyTo: string;
  passwordSet: boolean;
};

type HistoryRow = {
  id: string;
  kind: string;
  toAddress: string;
  subject: string;
  status: string;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
  nextAttemptAt: string;
};

export type MailSettingsData = {
  source: MailConfigSource;
  envSenderFields: MailSenderField[];
  disabled: boolean;
  configured: boolean;
  myEmail: string | null;
  form: FormValues;
  effective: {
    mailHost: string;
    mailPort: number;
    mailSecure: boolean;
    mailUsername: string;
    passwordSet: boolean;
    mailFromAddress: string;
    mailFromName: string;
    mailReplyTo: string;
    sender: string | null;
  };
  overview: {
    lastSentAt: string | null;
    sent7: number;
    failed7: number;
    pending: number;
    blocked7: number;
    recent: HistoryRow[];
  };
};

const KIND_LABELS: Record<string, string> = {
  test: "Testmail",
  notification: "Benachrichtigung",
  digest: "Zusammenfassung",
  karten: "Karten",
  einladung: "Einladung",
  fotoerlaubnis: "Fotoerlaubnis",
  system: "System",
};

const STATUS_BADGE: Record<
  string,
  { label: string; variant: "success" | "warning" | "destructive" | "muted" }
> = {
  sent: { label: "Gesendet", variant: "success" },
  pending: { label: "Wartet", variant: "warning" },
  failed: { label: "Fehlgeschlagen", variant: "destructive" },
  blocked: { label: "Abgeschaltet", variant: "muted" },
};

const timeFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
});

function useAction() {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const run = async (
    key: string,
    action: () => Promise<{ success: boolean; message?: string }>,
    success?: string,
  ) => {
    setPending(key);
    try {
      const result = await action();
      if (result.success) toast.success(result.message ?? success ?? "Erledigt.");
      else toast.error(result.message ?? "Das hat nicht geklappt.", { duration: 8000 });
      router.refresh();
      return result;
    } catch (error) {
      console.error("[MailSettings]", key, error);
      toast.error("Das hat nicht geklappt.");
      return null;
    } finally {
      setPending(null);
    }
  };
  return { pending, run };
}

export function MailSettings({ data }: { data: MailSettingsData }) {
  const { pending, run } = useAction();
  return (
    <div className="space-y-4">
      <StatusCard data={data} pending={pending} run={run} />
      <AccessCard data={data} />
      <SenderCard data={data} />
      <HistoryCard rows={data.overview.recent} pending={pending} run={run} />
    </div>
  );
}

type RunProps = ReturnType<typeof useAction>;

function StatusCard({ data, pending, run }: { data: MailSettingsData } & RunProps) {
  const { overview } = data;
  const state = !data.configured
    ? {
        tone: "destructive" as const,
        icon: <AlertTriangleIcon className="h-5 w-5" />,
        title: "Mailversand ist nicht eingerichtet",
        text: "Ohne SMTP-Server und Absender gehen keine Mails raus. Zugang unten eintragen.",
      }
    : data.disabled
      ? {
          tone: "muted" as const,
          icon: <LockIcon className="h-5 w-5" />,
          title: "Versand in dieser Umgebung abgeschaltet",
          text: "MAIL_DISABLED ist gesetzt (z. B. Staging mit echten Adressen). Nur die Testmail an dich geht raus.",
        }
      : overview.failed7 > 0 || overview.pending > 0
        ? {
            tone: "warning" as const,
            icon: <AlertTriangleIcon className="h-5 w-5" />,
            title: "Mailversand läuft – mit Problemen",
            text: `${overview.failed7} fehlgeschlagen in 7 Tagen, ${overview.pending} warten auf einen neuen Versuch.`,
          }
        : {
            tone: "success" as const,
            icon: <CheckCircleIcon className="h-5 w-5" />,
            title: "Mailversand läuft",
            text: data.effective.sender
              ? `Absender: ${data.effective.sender}`
              : "Alles in Ordnung.",
          };

  const iconClass = {
    destructive: "bg-destructive/15 text-destructive",
    warning: "bg-warning/20 text-warning",
    success: "bg-success/15 text-success",
    muted: "bg-muted text-muted-foreground",
  }[state.tone];

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
            iconClass,
          )}
        >
          {state.icon}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-base font-semibold text-foreground">{state.title}</h2>
          <p className="text-sm text-muted-foreground">{state.text}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Letzte Mail"
          value={overview.lastSentAt ? formatRelativeFromNow(new Date(overview.lastSentAt)) : "–"}
          icon={<ClockIcon className="h-4 w-4" />}
        />
        <StatTile
          label="Gesendet (7 Tage)"
          value={overview.sent7}
          tone="success"
          icon={<MailIcon className="h-4 w-4" />}
        />
        <StatTile
          label="Fehlgeschlagen"
          value={overview.failed7}
          tone={overview.failed7 ? "destructive" : "neutral"}
          icon={<AlertTriangleIcon className="h-4 w-4" />}
        />
        <StatTile
          label="Warteschlange"
          value={overview.pending}
          tone={overview.pending ? "warning" : "neutral"}
          icon={<RefreshIcon className="h-4 w-4" />}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <AsyncButton
          size="sm"
          isLoading={pending === "test-mail"}
          loadingText="Sende…"
          disabled={!data.myEmail}
          onClick={() => void run("test-mail", sendTestMailAction)}
        >
          <MailIcon className="h-4 w-4" />
          Testmail an mich
        </AsyncButton>
        <AsyncButton
          size="sm"
          variant="outline"
          isLoading={pending === "verify"}
          loadingText="Prüfe…"
          onClick={() => void run("verify", () => testMailServerConnectionAction({}))}
        >
          Verbindung prüfen
        </AsyncButton>
        <span className="text-xs text-muted-foreground">
          {data.myEmail ? `Geht an ${data.myEmail}` : "Keine E-Mail-Adresse in deinem Profil."}
        </span>
      </div>
    </Card>
  );
}

function FieldError({ errors, field }: { errors: FieldErrors; field: string }) {
  const messages = errors[field];
  if (!messages?.length) return null;
  return <p className="text-xs text-destructive">{messages.join(" ")}</p>;
}

function ReadOnlyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-md bg-muted/50 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-sm font-medium text-foreground">{value || "–"}</span>
    </div>
  );
}

function SecretBadge() {
  return (
    <Badge variant="muted" size="sm">
      <LockIcon />
      Aus Secret
    </Badge>
  );
}

function AccessCard({ data }: { data: MailSettingsData }) {
  const router = useRouter();
  const [values, setValues] = React.useState(data.form);
  const [password, setPassword] = React.useState<{ mode: "keep" | "set" | "clear"; value: string }>(
    { mode: "keep", value: "" },
  );
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [pending, setPending] = React.useState<string | null>(null);

  if (data.source === "env") {
    const { effective } = data;
    return (
      <Card className="space-y-3 p-4 sm:p-5">
        <SectionHeader
          title="Zugang zum SMTP-Server"
          description="Kommt aus dem Kubernetes-Secret (Vault) und ist hier nur lesbar."
          action={<SecretBadge />}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <ReadOnlyValue label="Server" value={effective.mailHost} />
          <ReadOnlyValue
            label="Port"
            value={`${effective.mailPort}${effective.mailSecure ? " · TLS" : " · STARTTLS"}`}
          />
          <ReadOnlyValue label="Benutzer" value={effective.mailUsername} />
          <ReadOnlyValue
            label="Passwort"
            value={effective.passwordSet ? "hinterlegt" : "nicht gesetzt"}
          />
        </div>
      </Card>
    );
  }

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: [] }));
  };

  const payload = () => ({
    mailHost: values.mailHost,
    mailPort: values.mailPort,
    mailSecure: values.mailSecure,
    mailUsername: values.mailUsername,
    ...(password.mode === "set" ? { mailPassword: password.value } : {}),
    ...(password.mode === "clear" ? { mailPassword: null } : {}),
  });

  const save = async () => {
    setPending("save");
    try {
      const result = await saveServerSettingsAction(payload());
      if (result.success) {
        toast.success("Zugang gespeichert.");
        setPassword({ mode: "keep", value: "" });
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error(
          result.error === "validation_failed"
            ? "Bitte Eingaben prüfen."
            : "Speichern fehlgeschlagen.",
        );
      }
    } finally {
      setPending(null);
    }
  };

  const verify = async () => {
    setPending("verify");
    try {
      const result = await testMailServerConnectionAction(payload());
      if (result.success) toast.success(result.message);
      else {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message, { duration: 8000 });
      }
    } finally {
      setPending(null);
    }
  };

  const autodetect = async () => {
    setPending("detect");
    try {
      const result = await autoDetectMailServerSettingsAction({
        mailHost: values.mailHost,
        mailUsername: values.mailUsername,
        mailFromAddress: data.effective.mailFromAddress,
      });
      if (result.success) {
        const { suggestion } = result;
        setValues((prev) => ({
          ...prev,
          mailHost: suggestion.mailHost,
          mailPort: String(suggestion.mailPort),
          mailSecure: suggestion.mailSecure,
          mailUsername: suggestion.mailUsername ?? prev.mailUsername,
        }));
        toast.success("Vorschlag übernommen – bitte prüfen und speichern.");
      } else toast.error(result.message);
    } finally {
      setPending(null);
    }
  };

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <SectionHeader
        title="Zugang zum SMTP-Server"
        description="Ist im Cluster ein Secret mit MAIL_HOST hinterlegt, gilt das – sonst diese Werte."
      />
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <div className="space-y-1.5">
          <Label htmlFor="mailHost">Server</Label>
          <Input
            id="mailHost"
            autoComplete="off"
            value={values.mailHost}
            onChange={(event) => set("mailHost", event.target.value)}
            placeholder="mail.example.org"
          />
          <FieldError errors={errors} field="mailHost" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mailPort">Port</Label>
          <Input
            id="mailPort"
            inputMode="numeric"
            value={values.mailPort}
            onChange={(event) => set("mailPort", event.target.value)}
            placeholder="587"
          />
          <FieldError errors={errors} field="mailPort" />
        </div>
      </div>
      <label className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2.5">
        <span className="space-y-0.5">
          <span className="block text-sm font-medium text-foreground">
            Direkt verschlüsselt (TLS)
          </span>
          <span className="block text-xs text-muted-foreground">
            An für Port 465, aus für 587 (STARTTLS).
          </span>
        </span>
        <Switch checked={values.mailSecure} onCheckedChange={(value) => set("mailSecure", value)} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="mailUsername">Benutzer</Label>
          <Input
            id="mailUsername"
            autoComplete="off"
            value={values.mailUsername}
            onChange={(event) => set("mailUsername", event.target.value)}
          />
          <FieldError errors={errors} field="mailUsername" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mailPassword">Passwort</Label>
          <PasswordInput
            id="mailPassword"
            autoComplete="new-password"
            value={password.mode === "set" ? password.value : ""}
            placeholder={
              password.mode === "clear"
                ? "Wird beim Speichern gelöscht"
                : values.passwordSet
                  ? "Unverändert"
                  : "Passwort eingeben"
            }
            onChange={(event) =>
              setPassword(
                event.target.value
                  ? { mode: "set", value: event.target.value }
                  : { mode: "keep", value: "" },
              )
            }
          />
          {values.passwordSet && password.mode !== "clear" ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setPassword({ mode: "clear", value: "" })}
            >
              Passwort löschen
            </Button>
          ) : null}
          <FieldError errors={errors} field="mailPassword" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <AsyncButton
          size="sm"
          isLoading={pending === "save"}
          loadingText="Speichere…"
          onClick={() => void save()}
        >
          Speichern
        </AsyncButton>
        <AsyncButton
          size="sm"
          variant="outline"
          isLoading={pending === "verify"}
          loadingText="Prüfe…"
          onClick={() => void verify()}
        >
          Verbindung prüfen
        </AsyncButton>
        <AsyncButton
          size="sm"
          variant="ghost"
          isLoading={pending === "detect"}
          loadingText="Suche…"
          onClick={() => void autodetect()}
        >
          Automatisch erkennen
        </AsyncButton>
      </div>
    </Card>
  );
}

const SENDER_FIELDS: {
  field: MailSenderField;
  label: string;
  type: string;
  placeholder: string;
}[] = [
  {
    field: "mailFromName",
    label: "Absendername",
    type: "text",
    placeholder: "Sommertheater Altrossthal",
  },
  {
    field: "mailFromAddress",
    label: "Absenderadresse",
    type: "email",
    placeholder: "noreply@example.org",
  },
  {
    field: "mailReplyTo",
    label: "Antworten an (optional)",
    type: "email",
    placeholder: "info@example.org",
  },
];

function SenderCard({ data }: { data: MailSettingsData }) {
  const router = useRouter();
  const [values, setValues] = React.useState(data.form);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [saving, setSaving] = React.useState(false);
  const editable = SENDER_FIELDS.filter(({ field }) => !data.envSenderFields.includes(field));

  const save = async () => {
    setSaving(true);
    try {
      const result = await saveServerSettingsAction(
        Object.fromEntries(editable.map(({ field }) => [field, values[field]])),
      );
      if (result.success) {
        toast.success("Absender gespeichert.");
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error("Bitte Eingaben prüfen.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <SectionHeader title="Absender" description="So erscheinen Mails im Postfach." />
      <div className="grid gap-4 sm:grid-cols-3">
        {SENDER_FIELDS.map(({ field, label, type, placeholder }) =>
          data.envSenderFields.includes(field) ? (
            <div key={field} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label>{label}</Label>
                <SecretBadge />
              </div>
              <ReadOnlyValue label="" value={data.effective[field]} />
            </div>
          ) : (
            <div key={field} className="space-y-1.5">
              <Label htmlFor={field}>{label}</Label>
              <Input
                id={field}
                type={type}
                value={values[field]}
                placeholder={placeholder}
                onChange={(event) => {
                  const value = event.target.value;
                  setValues((prev) => ({ ...prev, [field]: value }));
                  setErrors((prev) => ({ ...prev, [field]: [] }));
                }}
              />
              <FieldError errors={errors} field={field} />
            </div>
          ),
        )}
      </div>
      {editable.length ? (
        <AsyncButton
          size="sm"
          isLoading={saving}
          loadingText="Speichere…"
          onClick={() => void save()}
        >
          Speichern
        </AsyncButton>
      ) : null}
    </Card>
  );
}

function HistoryCard({ rows, pending, run }: { rows: HistoryRow[] } & RunProps) {
  const [filter, setFilter] = React.useState<"all" | "problems">("all");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const visible =
    filter === "all"
      ? rows
      : rows.filter((row) => row.status === "failed" || row.status === "pending");

  return (
    <Card className="space-y-3 p-4 sm:p-5">
      <SectionHeader
        title="Versandverlauf"
        description="Die letzten 50 Mails. Inhalte werden nach 30 Tagen gelöscht."
        action={
          <SegmentedControl
            aria-label="Filter"
            value={filter}
            onValueChange={setFilter}
            options={[
              { value: "all", label: "Alle" },
              { value: "problems", label: "Probleme" },
            ]}
          />
        }
      />
      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {filter === "all" ? "Noch keine Mails verschickt." : "Keine Probleme. 🎉"}
        </p>
      ) : (
        <div className="-mx-3 divide-y divide-border/60">
          {visible.map((row) => {
            const badge = STATUS_BADGE[row.status] ?? STATUS_BADGE.pending;
            const open = openId === row.id;
            return (
              <div key={row.id}>
                <ListRow
                  density="compact"
                  onClick={() => setOpenId(open ? null : row.id)}
                  chevron={false}
                  title={row.subject}
                  description={`${KIND_LABELS[row.kind] ?? row.kind} · ${row.toAddress} · ${timeFormatter.format(new Date(row.sentAt ?? row.createdAt))}`}
                  trailing={
                    <Badge variant={badge.variant} size="sm">
                      {badge.label}
                    </Badge>
                  }
                />
                {open ? (
                  <div className="space-y-2 px-3 pb-3 text-xs text-muted-foreground">
                    <p>
                      Versuche: {row.attempts}
                      {row.status === "pending"
                        ? ` · nächster Versuch ${timeFormatter.format(new Date(row.nextAttemptAt))}`
                        : ""}
                    </p>
                    {row.lastError ? (
                      <p className="break-words rounded-md bg-muted/60 p-2 font-mono text-[11px] text-foreground">
                        {row.lastError}
                      </p>
                    ) : null}
                    {row.status === "failed" || row.status === "pending" ? (
                      <AsyncButton
                        size="xs"
                        variant="outline"
                        isLoading={pending === `retry-${row.id}`}
                        loadingText="Sende…"
                        onClick={() => void run(`retry-${row.id}`, () => retryMailAction(row.id))}
                      >
                        Jetzt erneut senden
                      </AsyncButton>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
