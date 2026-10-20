import { z } from "zod";

import { MAX_MAIL_PORT, MIN_MAIL_PORT, type ServerSettingsInput } from "@/lib/server-settings";

import type { EffectiveMailSettings } from "./config";

/** Prüfung der SMTP-Eingaben aus der Admin-Seite (ohne "use server", siehe AGENTS.md). */
const EMAIL_SCHEMA = z.string().email();

const MAX_TEXT_LENGTH = 255;
const MAX_NAME_LENGTH = 120;
const MAX_PASSWORD_LENGTH = 512;

export type FieldErrors = Record<string, string[]>;

function appendFieldError(errors: FieldErrors, field: string, message: string) {
  if (!errors[field]) {
    errors[field] = [];
  }
  errors[field]!.push(message);
}

export function validateServerSettingsPayload(
  raw: Partial<Record<keyof ServerSettingsInput, unknown>>,
): { success: true; data: ServerSettingsInput } | { success: false; fieldErrors: FieldErrors } {
  const errors: FieldErrors = {};
  const data: ServerSettingsInput = {};

  if (Object.prototype.hasOwnProperty.call(raw, "mailHost")) {
    const value = raw.mailHost;
    if (value === null) {
      data.mailHost = null;
    } else if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        data.mailHost = null;
      } else if (trimmed.length > MAX_TEXT_LENGTH) {
        appendFieldError(errors, "mailHost", `Maximal ${MAX_TEXT_LENGTH} Zeichen erlaubt.`);
      } else {
        data.mailHost = trimmed;
      }
    } else if (value === undefined) {
      // ignore
    } else {
      appendFieldError(errors, "mailHost", "Ungültiger Servername.");
    }
  }

  if (Object.prototype.hasOwnProperty.call(raw, "mailPort")) {
    const value = raw.mailPort;
    if (value === null || value === undefined || value === "") {
      // ignore empty values
    } else {
      const numeric = typeof value === "number" ? value : Number(String(value));
      if (!Number.isFinite(numeric) || !Number.isInteger(numeric)) {
        appendFieldError(errors, "mailPort", "Der Port muss eine ganze Zahl sein.");
      } else if (numeric < MIN_MAIL_PORT || numeric > MAX_MAIL_PORT) {
        appendFieldError(
          errors,
          "mailPort",
          `Der Port muss zwischen ${MIN_MAIL_PORT} und ${MAX_MAIL_PORT} liegen.`,
        );
      } else {
        data.mailPort = numeric;
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(raw, "mailSecure")) {
    const value = raw.mailSecure;
    if (typeof value === "boolean") {
      data.mailSecure = value;
    } else if (typeof value === "string") {
      if (value === "true") {
        data.mailSecure = true;
      } else if (value === "false") {
        data.mailSecure = false;
      } else {
        appendFieldError(errors, "mailSecure", "Ungültiger Wert für TLS/SSL.");
      }
    } else if (value !== undefined && value !== null) {
      appendFieldError(errors, "mailSecure", "Ungültiger Wert für TLS/SSL.");
    }
  }

  if (Object.prototype.hasOwnProperty.call(raw, "mailUsername")) {
    const value = raw.mailUsername;
    if (value === null) {
      data.mailUsername = null;
    } else if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        data.mailUsername = null;
      } else if (trimmed.length > MAX_TEXT_LENGTH) {
        appendFieldError(errors, "mailUsername", `Maximal ${MAX_TEXT_LENGTH} Zeichen erlaubt.`);
      } else {
        data.mailUsername = trimmed;
      }
    } else if (value !== undefined) {
      appendFieldError(errors, "mailUsername", "Ungültiger Benutzername.");
    }
  }

  if (Object.prototype.hasOwnProperty.call(raw, "mailPassword")) {
    const value = raw.mailPassword;
    if (value === null) {
      data.mailPassword = null;
    } else if (typeof value === "string") {
      if (value.length === 0) {
        data.mailPassword = null;
      } else if (value.length > MAX_PASSWORD_LENGTH) {
        appendFieldError(errors, "mailPassword", `Maximal ${MAX_PASSWORD_LENGTH} Zeichen erlaubt.`);
      } else {
        data.mailPassword = value;
      }
    } else if (value !== undefined) {
      appendFieldError(errors, "mailPassword", "Ungültiges Passwort.");
    }
  }

  if (Object.prototype.hasOwnProperty.call(raw, "mailFromAddress")) {
    const value = raw.mailFromAddress;
    if (value === null) {
      data.mailFromAddress = null;
    } else if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        data.mailFromAddress = null;
      } else if (!EMAIL_SCHEMA.safeParse(trimmed).success) {
        appendFieldError(errors, "mailFromAddress", "Ungültige E-Mail-Adresse.");
      } else {
        data.mailFromAddress = trimmed;
      }
    } else if (value !== undefined) {
      appendFieldError(errors, "mailFromAddress", "Ungültige E-Mail-Adresse.");
    }
  }

  if (Object.prototype.hasOwnProperty.call(raw, "mailFromName")) {
    const value = raw.mailFromName;
    if (value === null) {
      data.mailFromName = null;
    } else if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        data.mailFromName = null;
      } else if (trimmed.length > MAX_NAME_LENGTH) {
        appendFieldError(errors, "mailFromName", `Maximal ${MAX_NAME_LENGTH} Zeichen erlaubt.`);
      } else {
        data.mailFromName = trimmed;
      }
    } else if (value !== undefined) {
      appendFieldError(errors, "mailFromName", "Ungültiger Anzeigename.");
    }
  }

  if (Object.prototype.hasOwnProperty.call(raw, "mailReplyTo")) {
    const value = raw.mailReplyTo;
    if (value === null) {
      data.mailReplyTo = null;
    } else if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        data.mailReplyTo = null;
      } else if (!EMAIL_SCHEMA.safeParse(trimmed).success) {
        appendFieldError(errors, "mailReplyTo", "Ungültige E-Mail-Adresse.");
      } else {
        data.mailReplyTo = trimmed;
      }
    } else if (value !== undefined) {
      appendFieldError(errors, "mailReplyTo", "Ungültige E-Mail-Adresse.");
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, fieldErrors: errors };
  }

  return { success: true, data };
}

const SERVER_FIELDS = [
  "mailHost",
  "mailPort",
  "mailSecure",
  "mailUsername",
  "mailPassword",
] as const;

/** Entfernt Felder, die aus dem Secret kommen – die Oberfläche darf sie nicht überschreiben. */
export function stripEnvManagedFields(
  input: ServerSettingsInput,
  effective: Pick<EffectiveMailSettings, "source" | "envSenderFields">,
): ServerSettingsInput {
  const next: ServerSettingsInput = { ...input };
  if (effective.source === "env") {
    for (const field of SERVER_FIELDS) delete next[field];
  }
  for (const field of effective.envSenderFields) delete next[field];
  return next;
}
