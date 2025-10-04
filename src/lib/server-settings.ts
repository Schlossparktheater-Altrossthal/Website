import { prisma } from "@/lib/prisma";
import type { Prisma, ServerSettings } from "@prisma/client";
import { z } from "zod";

export const DEFAULT_SERVER_SETTINGS_ID = "default";
export const DEFAULT_MAIL_PORT = 587;
export const MIN_MAIL_PORT = 1;
export const MAX_MAIL_PORT = 65535;

const EMAIL_SCHEMA = z.string().email();

function trimToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalisePort(value: number | null | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return DEFAULT_MAIL_PORT;
  }
  const intPort = Math.trunc(value);
  if (!Number.isInteger(intPort)) {
    return DEFAULT_MAIL_PORT;
  }
  return Math.min(Math.max(intPort, MIN_MAIL_PORT), MAX_MAIL_PORT);
}

function normaliseBoolean(value: boolean | null | undefined, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  return fallback;
}

function normaliseEmail(value: string | null | undefined): string | null {
  const trimmed = trimToNull(value);
  if (!trimmed) {
    return null;
  }
  const parsed = EMAIL_SCHEMA.safeParse(trimmed);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}

export type ServerSettingsRecord = ServerSettings | null;

export type ResolvedServerSettings = {
  id: string;
  mailHost: string | null;
  mailPort: number;
  mailSecure: boolean;
  mailUsername: string | null;
  mailPassword: string | null;
  mailFromAddress: string | null;
  mailFromName: string | null;
  mailReplyTo: string | null;
  updatedAt: Date | null;
};

export function resolveServerSettings(record: ServerSettingsRecord): ResolvedServerSettings {
  return {
    id: record?.id ?? DEFAULT_SERVER_SETTINGS_ID,
    mailHost: trimToNull(record?.mailHost ?? null),
    mailPort: normalisePort(record?.mailPort ?? DEFAULT_MAIL_PORT),
    mailSecure: normaliseBoolean(record?.mailSecure, false),
    mailUsername: trimToNull(record?.mailUsername ?? null),
    mailPassword: record?.mailPassword ?? null,
    mailFromAddress: normaliseEmail(record?.mailFromAddress ?? null),
    mailFromName: trimToNull(record?.mailFromName ?? null),
    mailReplyTo: normaliseEmail(record?.mailReplyTo ?? null),
    updatedAt: record?.updatedAt ?? null,
  };
}

export type ClientServerSettings = {
  id: string;
  mailHost: string;
  mailPort: number;
  mailSecure: boolean;
  mailUsername: string;
  mailFromAddress: string;
  mailFromName: string;
  mailReplyTo: string;
  mailPasswordSet: boolean;
  updatedAt: string | null;
};

export function toClientServerSettings(resolved: ResolvedServerSettings): ClientServerSettings {
  return {
    id: resolved.id,
    mailHost: resolved.mailHost ?? "",
    mailPort: resolved.mailPort,
    mailSecure: resolved.mailSecure,
    mailUsername: resolved.mailUsername ?? "",
    mailFromAddress: resolved.mailFromAddress ?? "",
    mailFromName: resolved.mailFromName ?? "",
    mailReplyTo: resolved.mailReplyTo ?? "",
    mailPasswordSet: Boolean(resolved.mailPassword && resolved.mailPassword.length > 0),
    updatedAt: resolved.updatedAt ? resolved.updatedAt.toISOString() : null,
  };
}

export type ServerSettingsInput = {
  mailHost?: string | null;
  mailPort?: number | null;
  mailSecure?: boolean | null;
  mailUsername?: string | null;
  mailPassword?: string | null;
  mailFromAddress?: string | null;
  mailFromName?: string | null;
  mailReplyTo?: string | null;
};

export async function readServerSettings() {
  return prisma.serverSettings.findUnique({ where: { id: DEFAULT_SERVER_SETTINGS_ID } });
}

export async function ensureServerSettingsRecord() {
  const existing = await prisma.serverSettings.findUnique({ where: { id: DEFAULT_SERVER_SETTINGS_ID } });
  if (existing) {
    return existing;
  }
  return prisma.serverSettings.create({ data: { id: DEFAULT_SERVER_SETTINGS_ID } });
}

export async function loadResolvedServerSettings(): Promise<ResolvedServerSettings> {
  const record = await ensureServerSettingsRecord();
  return resolveServerSettings(record);
}

export async function saveServerSettings(input: ServerSettingsInput) {
  const update: Prisma.ServerSettingsUpdateInput = {};
  const create: Prisma.ServerSettingsCreateInput = {
    id: DEFAULT_SERVER_SETTINGS_ID,
  };

  if (input.mailHost !== undefined) {
    update.mailHost = input.mailHost;
    create.mailHost = input.mailHost;
  }

  if (input.mailPort !== undefined && input.mailPort !== null) {
    update.mailPort = input.mailPort;
    create.mailPort = input.mailPort;
  }

  if (input.mailSecure !== undefined && input.mailSecure !== null) {
    update.mailSecure = input.mailSecure;
    create.mailSecure = input.mailSecure;
  }

  if (input.mailUsername !== undefined) {
    update.mailUsername = input.mailUsername;
    create.mailUsername = input.mailUsername;
  }

  if (input.mailPassword !== undefined) {
    update.mailPassword = input.mailPassword;
    create.mailPassword = input.mailPassword;
  }

  if (input.mailFromAddress !== undefined) {
    update.mailFromAddress = input.mailFromAddress;
    create.mailFromAddress = input.mailFromAddress;
  }

  if (input.mailFromName !== undefined) {
    update.mailFromName = input.mailFromName;
    create.mailFromName = input.mailFromName;
  }

  if (input.mailReplyTo !== undefined) {
    update.mailReplyTo = input.mailReplyTo;
    create.mailReplyTo = input.mailReplyTo;
  }

  const record = await prisma.serverSettings.upsert({
    where: { id: DEFAULT_SERVER_SETTINGS_ID },
    update,
    create,
  });

  return resolveServerSettings(record);
}

export function applyServerSettingsPatch(
  base: ResolvedServerSettings,
  patch: ServerSettingsInput,
): ResolvedServerSettings {
  return {
    ...base,
    mailHost: patch.mailHost !== undefined ? trimToNull(patch.mailHost) : base.mailHost,
    mailPort:
      patch.mailPort !== undefined && patch.mailPort !== null
        ? normalisePort(patch.mailPort)
        : base.mailPort,
    mailSecure:
      patch.mailSecure !== undefined && patch.mailSecure !== null
        ? normaliseBoolean(patch.mailSecure, base.mailSecure)
        : base.mailSecure,
    mailUsername: patch.mailUsername !== undefined ? trimToNull(patch.mailUsername) : base.mailUsername,
    mailPassword: patch.mailPassword !== undefined ? patch.mailPassword : base.mailPassword,
    mailFromAddress:
      patch.mailFromAddress !== undefined ? normaliseEmail(patch.mailFromAddress) : base.mailFromAddress,
    mailFromName: patch.mailFromName !== undefined ? trimToNull(patch.mailFromName) : base.mailFromName,
    mailReplyTo:
      patch.mailReplyTo !== undefined ? normaliseEmail(patch.mailReplyTo) : base.mailReplyTo,
  };
}

export function formatSenderAddress(settings: ResolvedServerSettings): string | null {
  const fromAddress = settings.mailFromAddress ?? settings.mailUsername ?? null;
  if (!fromAddress) {
    return null;
  }
  const displayName = settings.mailFromName ? settings.mailFromName.trim() : "";
  if (!displayName || !settings.mailFromAddress) {
    return fromAddress;
  }
  return `${displayName} <${fromAddress}>`;
}
