"use client";

import { useId, useMemo, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { ClientServerSettings } from "@/lib/server-settings";

import {
  saveServerSettingsAction,
  testMailServerConnectionAction,
  autoDetectMailServerSettingsAction,
  type SaveServerSettingsResult,
  type TestMailServerResult,
  type AutoDetectMailServerResult,
} from "./actions";

type ServerSettingsFormValues = {
  mailHost: string;
  mailPort: string;
  mailSecure: boolean;
  mailUsername: string;
  mailFromAddress: string;
  mailFromName: string;
  mailReplyTo: string;
};

type PasswordState = {
  mode: "preserve" | "update" | "clear";
  value: string;
};

type FieldErrors = Record<string, string[]>;

type TestFeedback = {
  variant: "success" | "error";
  message: string;
} | null;

const STEPS = [
  { id: "identity", label: "Absender" },
  { id: "credentials", label: "Zugangsdaten" },
  { id: "server", label: "Server" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

function isValidationError<Result extends { success: boolean; error?: unknown; fieldErrors?: FieldErrors }>(
  result: Result,
): result is Result & { success: false; fieldErrors: FieldErrors } {
  return result.success === false && Boolean(result.fieldErrors);
}

type ServerSettingsContentProps = {
  initialSettings: ClientServerSettings;
};

export function ServerSettingsContent({ initialSettings }: ServerSettingsContentProps) {
  const [formState, setFormState] = useState<ServerSettingsFormValues>({
    mailHost: initialSettings.mailHost,
    mailPort: String(initialSettings.mailPort ?? ""),
    mailSecure: initialSettings.mailSecure,
    mailUsername: initialSettings.mailUsername,
    mailFromAddress: initialSettings.mailFromAddress,
    mailFromName: initialSettings.mailFromName,
    mailReplyTo: initialSettings.mailReplyTo,
  });
  const [passwordState, setPasswordState] = useState<PasswordState>({ mode: "preserve", value: "" });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [testFeedback, setTestFeedback] = useState<TestFeedback>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(initialSettings.updatedAt);
  const [passwordPersisted, setPasswordPersisted] = useState<boolean>(initialSettings.mailPasswordSet);
  const [autoDetectInfo, setAutoDetectInfo] = useState<string | null>(null);
  const passwordHintId = useId();
  const [activeStep, setActiveStep] = useState<StepId>(() => {
    if (initialSettings.mailHost) {
      return "server";
    }
    if (initialSettings.mailUsername || initialSettings.mailPasswordSet) {
      return "credentials";
    }
    if (initialSettings.mailFromAddress) {
      return "identity";
    }
    return "identity";
  });

  const [isSaving, startSaving] = useTransition();
  const [isTesting, startTesting] = useTransition();
  const [isAutodetecting, startAutodetect] = useTransition();

  const activeStepIndex = useMemo(
    () => STEPS.findIndex((step) => step.id === activeStep),
    [activeStep],
  );

  const goToStep = (step: StepId) => {
    setActiveStep(step);
    setTestFeedback(null);
  };

  const goToPreviousStep = () => {
    if (activeStepIndex > 0) {
      goToStep(STEPS[activeStepIndex - 1]!.id);
    }
  };

  const goToNextStep = () => {
    if (activeStepIndex < STEPS.length - 1) {
      goToStep(STEPS[activeStepIndex + 1]!.id);
    }
  };

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdated) {
      return "Noch nie gespeichert";
    }
    const parsed = new Date(lastUpdated);
    if (Number.isNaN(parsed.valueOf())) {
      return "Unbekannt";
    }
    return dateFormatter.format(parsed);
  }, [lastUpdated]);

  const clearFieldError = (field: keyof FieldErrors) => {
    if (fieldErrors[field]?.length) {
      setFieldErrors((previous) => {
        const next = { ...previous };
        delete next[field];
        return next;
      });
    }
  };

  const handleTextChange = (field: keyof ServerSettingsFormValues) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setFormState((previous) => ({ ...previous, [field]: value }));
      clearFieldError(field);
      if (
        field === "mailHost" ||
        field === "mailPort" ||
        field === "mailUsername" ||
        field === "mailFromAddress"
      ) {
        setAutoDetectInfo(null);
      }
    };

  const handleSecureChange = (event: ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    setFormState((previous) => ({ ...previous, mailSecure: checked }));
    clearFieldError("mailSecure");
    setAutoDetectInfo(null);
  };

  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setPasswordState({ mode: "update", value });
    clearFieldError("mailPassword");
  };

  const resetPasswordState = () => {
    setPasswordState({ mode: "preserve", value: "" });
    clearFieldError("mailPassword");
  };

  const handleClearPassword = () => {
    setPasswordState({ mode: "clear", value: "" });
    clearFieldError("mailPassword");
  };

  const buildPayload = (): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
      mailHost: formState.mailHost,
      mailSecure: formState.mailSecure,
      mailUsername: formState.mailUsername,
      mailFromAddress: formState.mailFromAddress,
      mailFromName: formState.mailFromName,
      mailReplyTo: formState.mailReplyTo,
    };

    const trimmedPort = formState.mailPort.trim();
    payload.mailPort = trimmedPort === "" ? "" : trimmedPort;

    if (passwordState.mode === "update") {
      payload.mailPassword = passwordState.value;
    } else if (passwordState.mode === "clear") {
      payload.mailPassword = "";
    }

    return payload;
  };

  const applySaveResult = (result: SaveServerSettingsResult) => {
    if (result.success) {
      setFormState({
        mailHost: result.settings.mailHost,
        mailPort: String(result.settings.mailPort ?? ""),
        mailSecure: result.settings.mailSecure,
        mailUsername: result.settings.mailUsername,
        mailFromAddress: result.settings.mailFromAddress,
        mailFromName: result.settings.mailFromName,
        mailReplyTo: result.settings.mailReplyTo,
      });
      setPasswordState({ mode: "preserve", value: "" });
      setFieldErrors({});
      setTestFeedback(null);
      setAutoDetectInfo(null);
      setLastUpdated(result.settings.updatedAt);
      setPasswordPersisted(result.settings.mailPasswordSet);
      toast.success("Servereinstellungen gespeichert.");
      return;
    }

    if (result.error === "not_authorized") {
      toast.error("Du darfst diese Einstellungen nicht ändern.");
      return;
    }

    if (result.error === "no_database") {
      toast.error("Ohne Datenbank können die Einstellungen nicht gespeichert werden.");
      return;
    }

    if (isValidationError(result)) {
      setFieldErrors(result.fieldErrors);
      toast.error("Bitte prüfe die markierten Felder.");
      return;
    }

    toast.error("Die Einstellungen konnten nicht gespeichert werden.");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTestFeedback(null);
    startSaving(async () => {
      const payload = buildPayload();
      const result = await saveServerSettingsAction(payload);
      applySaveResult(result);
    });
  };

  const applyTestResult = (result: TestMailServerResult) => {
    if (result.success) {
      const feedback: TestFeedback = { variant: "success", message: result.message };
      setTestFeedback(feedback);
      toast.success(result.message);
      return;
    }

    if (result.error === "not_authorized") {
      const message = "Du darfst die Verbindung nicht testen.";
      setTestFeedback({ variant: "error", message });
      toast.error(message);
      return;
    }

    if (result.error === "no_database") {
      const message = "Ohne Datenbankverbindung kann keine Prüfung erfolgen.";
      setTestFeedback({ variant: "error", message });
      toast.error(message);
      return;
    }

    if (isValidationError(result)) {
      setFieldErrors(result.fieldErrors);
      const message = "Bitte prüfe die markierten Felder.";
      setTestFeedback({ variant: "error", message });
      toast.error(message);
      return;
    }

    const message = result.message ?? "Verbindungstest fehlgeschlagen.";
    setTestFeedback({ variant: "error", message });
    toast.error(message);
  };

  const handleTest = () => {
    setTestFeedback(null);
    startTesting(async () => {
      const payload = buildPayload();
      const result = await testMailServerConnectionAction(payload);
      applyTestResult(result);
    });
  };

  const applyAutoDetectResult = (result: AutoDetectMailServerResult) => {
    if (result.success) {
      setFormState((previous) => ({
        ...previous,
        mailHost: result.suggestion.mailHost,
        mailPort: String(result.suggestion.mailPort ?? ""),
        mailSecure: result.suggestion.mailSecure,
        mailUsername: result.suggestion.mailUsername ?? previous.mailUsername,
      }));
      setFieldErrors((previous) => {
        const next = { ...previous };
        delete next.mailHost;
        delete next.mailPort;
        delete next.mailSecure;
        delete next.mailUsername;
        return next;
      });
      const providerSuffix = result.suggestion.provider ? ` (${result.suggestion.provider})` : "";
      const confidenceLabel = (() => {
        switch (result.suggestion.confidence) {
          case "high":
            return `Vorkonfiguration${providerSuffix} erkannt.`;
          case "medium":
            return `Vorschlag anhand der vorhandenen Angaben${providerSuffix}.`;
          default:
            return `Generischer Vorschlag basierend auf der Domain${providerSuffix}.`;
        }
      })();
      setAutoDetectInfo(confidenceLabel);
      toast.success("SMTP-Einstellungen wurden vorausgefüllt.");
      return true;
    }

    if (result.error === "not_authorized") {
      toast.error("Du darfst diese Einstellungen nicht ändern.");
      return false;
    }

    if (isValidationError(result) && result.fieldErrors) {
      setFieldErrors(result.fieldErrors);
      toast.error("Bitte prüfe die markierten Felder.");
      return false;
    }

    const message = result.message ?? "Die SMTP-Einstellungen konnten nicht automatisch erkannt werden.";
    toast.error(message);
    return false;
  };

  const handleAutoDetect = (options?: { advanceOnSuccess?: StepId }) => {
    setAutoDetectInfo(null);
    startAutodetect(async () => {
      const payload = buildPayload();
      const result = await autoDetectMailServerSettingsAction(payload);
      const success = applyAutoDetectResult(result);
      if (success && options?.advanceOnSuccess) {
        goToStep(options.advanceOnSuccess);
      }
    });
  };

  const renderFieldErrors = (field: keyof FieldErrors) => {
    const messages = fieldErrors[field];
    if (!messages?.length) {
      return null;
    }
    return (
      <ul className="space-y-1 pt-1 text-xs text-destructive">
        {messages.map((message, index) => (
          <li key={`${field}-${index}`}>{message}</li>
        ))}
      </ul>
    );
  };

  const passwordHint = (() => {
    if (passwordState.mode === "update") {
      return "Neues Passwort wird beim Speichern übernommen.";
    }
    if (passwordState.mode === "clear") {
      return "Das gespeicherte Passwort wird entfernt.";
    }
    if (passwordPersisted) {
      return "Aktuell ist ein Passwort hinterlegt.";
    }
    return "Es ist kein Passwort hinterlegt.";
  })();

  const identityStep = (
    <section className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="mailFromName">Absendername</Label>
        <Input
          id="mailFromName"
          value={formState.mailFromName}
          onChange={handleTextChange("mailFromName")}
          placeholder="Sommertheater"
        />
        {renderFieldErrors("mailFromName")}
      </div>
      <div className="space-y-2">
        <Label htmlFor="mailFromAddress">Absenderadresse</Label>
        <Input
          id="mailFromAddress"
          type="email"
          autoComplete="off"
          value={formState.mailFromAddress}
          onChange={handleTextChange("mailFromAddress")}
          placeholder="post@example.org"
        />
        {renderFieldErrors("mailFromAddress")}
      </div>
      <div className="space-y-2">
        <Label htmlFor="mailReplyTo">Antwortadresse (optional)</Label>
        <Input
          id="mailReplyTo"
          type="email"
          autoComplete="off"
          value={formState.mailReplyTo}
          onChange={handleTextChange("mailReplyTo")}
          placeholder="support@example.org"
        />
        {renderFieldErrors("mailReplyTo")}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={goToNextStep}>
          Weiter
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => goToStep("server")}
          disabled={isSaving || isTesting || isAutodetecting}
        >
          Manuell konfigurieren
        </Button>
        <span className="text-xs text-muted-foreground">
          Diese Angaben helfen beim automatischen Einrichten.
        </span>
      </div>
    </section>
  );

  const credentialsStep = (
    <section className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Hinterlege hier die Zugangsdaten für den Versand. Mit einem Klick auf „Automatisch konfigurieren“
        versucht das System anschließend, passende Servereinstellungen zu ermitteln.
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="mailUsername">Benutzername</Label>
          <Input
            id="mailUsername"
            autoComplete="off"
            value={formState.mailUsername}
            onChange={handleTextChange("mailUsername")}
            placeholder="smtp-user"
          />
          {renderFieldErrors("mailUsername")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="mailPassword">Passwort</Label>
          <Input
            id="mailPassword"
            type="password"
            autoComplete="new-password"
            value={passwordState.mode === "update" ? passwordState.value : ""}
            placeholder={passwordPersisted ? "Passwort unverändert" : "Passwort eingeben"}
            onChange={handlePasswordChange}
            aria-describedby={passwordHintId}
          />
          <div id={passwordHintId} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{passwordHint}</span>
            {passwordState.mode !== "preserve" ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={resetPasswordState}
                disabled={isSaving || isTesting}
              >
                Änderung verwerfen
              </Button>
            ) : null}
            {passwordState.mode !== "clear" && passwordPersisted ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleClearPassword}
                disabled={isSaving || isTesting}
              >
                Passwort löschen
              </Button>
            ) : null}
          </div>
          {renderFieldErrors("mailPassword")}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={goToPreviousStep}
          disabled={isSaving || isTesting || isAutodetecting}
        >
          Zurück
        </Button>
        <Button type="button" onClick={goToNextStep} disabled={isSaving || isTesting || isAutodetecting}>
          Weiter
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => handleAutoDetect({ advanceOnSuccess: "server" })}
          disabled={isAutodetecting || isSaving || isTesting}
          data-state={isAutodetecting ? "loading" : undefined}
        >
          Automatisch konfigurieren
        </Button>
        <span className="text-xs text-muted-foreground">
          Wir nutzen Name, E-Mail-Adresse und Benutzername für die Erkennung.
        </span>
      </div>
    </section>
  );

  const serverStep = (
    <section className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="mailHost">SMTP-Server</Label>
          <Input
            id="mailHost"
            autoComplete="off"
            value={formState.mailHost}
            onChange={handleTextChange("mailHost")}
            placeholder="smtp.example.org"
          />
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAutoDetect()}
              disabled={isAutodetecting || isSaving || isTesting}
              data-state={isAutodetecting ? "loading" : undefined}
            >
              Automatisch erkennen
            </Button>
            {autoDetectInfo ? <span className="text-xs text-muted-foreground">{autoDetectInfo}</span> : null}
          </div>
          {renderFieldErrors("mailHost")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="mailPort">Port</Label>
          <Input
            id="mailPort"
            inputMode="numeric"
            pattern="[0-9]*"
            value={formState.mailPort}
            onChange={handleTextChange("mailPort")}
            placeholder="587"
          />
          {renderFieldErrors("mailPort")}
        </div>
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-3 text-sm font-medium text-foreground" htmlFor="mailSecure">
          <input
            id="mailSecure"
            type="checkbox"
            checked={formState.mailSecure}
            onChange={handleSecureChange}
            className="h-4 w-4 rounded border border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
          <span>TLS/SSL für den Versand verwenden</span>
        </label>
        <p className="text-xs text-muted-foreground">
          Aktiviere diese Option für sichere Verbindungen (z.&nbsp;B. Port 465 oder STARTTLS).
        </p>
        {renderFieldErrors("mailSecure")}
      </div>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Die Zugangsdaten kannst du bei Bedarf im vorherigen Schritt anpassen.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => goToStep("credentials")}
          disabled={isSaving || isTesting || isAutodetecting}
        >
          Zugangsdaten bearbeiten
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={goToPreviousStep}
          disabled={isSaving || isTesting || isAutodetecting}
        >
          Zurück
        </Button>
        <Button type="submit" disabled={isSaving} data-state={isSaving ? "loading" : undefined}>
          Einstellungen speichern
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleTest}
          disabled={isTesting || isSaving}
          data-state={isTesting ? "loading" : undefined}
        >
          Verbindung testen
        </Button>
        {testFeedback ? (
          <span
            className={
              testFeedback.variant === "success"
                ? "text-xs font-medium text-success"
                : "text-xs font-medium text-destructive"
            }
          >
            {testFeedback.message}
          </span>
        ) : null}
      </div>
    </section>
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2">
        <CardTitle>SMTP-Server</CardTitle>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>Zuletzt aktualisiert: {lastUpdatedLabel}</span>
          {passwordPersisted ? <Badge variant="muted">Passwort gespeichert</Badge> : null}
        </div>
      </CardHeader>
      <CardContent>
        <form className="space-y-8" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Der Assistent führt dich Schritt für Schritt durch die Einrichtung. Du kannst jederzeit zu einem vorherigen Schritt
              zurückkehren oder direkt zur manuellen Konfiguration wechseln.
            </p>
            <ol className="flex flex-wrap items-center gap-6 text-sm font-medium">
              {STEPS.map((step, index) => {
                const isActive = step.id === activeStep;
                const isCompleted = index < activeStepIndex;
                return (
                  <li key={step.id} className="flex items-center gap-3">
                    <span
                      className={
                        "flex h-7 w-7 items-center justify-center rounded-full border text-xs" +
                        (isActive
                          ? " border-primary bg-primary/10 text-primary"
                          : isCompleted
                          ? " border-primary bg-primary text-primary-foreground"
                          : " border-muted-foreground/40 text-muted-foreground")
                      }
                    >
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => goToStep(step.id)}
                      disabled={isSaving || isTesting || isAutodetecting}
                      className={
                        "text-left" +
                        (isActive
                          ? " text-foreground"
                          : isCompleted
                          ? " text-foreground"
                          : " text-muted-foreground") +
                        (isSaving || isTesting || isAutodetecting ? " cursor-not-allowed opacity-70" : "")
                      }
                    >
                      {step.label}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
          {activeStep === "identity" ? identityStep : null}
          {activeStep === "credentials" ? credentialsStep : null}
          {activeStep === "server" ? serverStep : null}
        </form>
      </CardContent>
    </Card>
  );
}
