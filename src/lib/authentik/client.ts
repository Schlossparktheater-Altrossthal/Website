import { z } from "zod";

import {
  AUTHENTIK_MANAGED_USER_PATH,
  getAuthentikApiConfig,
  type AuthentikApiConfig,
} from "@/lib/authentik/config";

const REQUEST_TIMEOUT_MS = 8000;

const authentikUserSchema = z.object({
  pk: z.number(),
  /** Entspricht dem OIDC-"sub" (sub_mode hashed_user_id). */
  uid: z.string(),
  username: z.string(),
  name: z.string(),
  email: z.string(),
  is_active: z.boolean(),
  path: z.string(),
});

export type AuthentikUser = z.infer<typeof authentikUserSchema>;

const userListSchema = z.object({ results: z.array(authentikUserSchema) });
const emailStageListSchema = z.object({
  results: z.array(z.object({ pk: z.string(), name: z.string() })),
});

export class AuthentikApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AuthentikApiError";
  }
}

function requireConfig(): AuthentikApiConfig {
  const config = getAuthentikApiConfig();
  if (!config) {
    throw new AuthentikApiError("Authentik-API ist nicht konfiguriert");
  }
  return config;
}

async function request(
  config: AuthentikApiConfig,
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string> } = {},
): Promise<unknown> {
  const url = new URL(`${config.baseUrl}/api/v3${path}`);
  for (const [key, value] of Object.entries(init.query ?? {})) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/json",
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new AuthentikApiError(
      `Authentik ${init.method ?? "GET"} ${path} fehlgeschlagen (${response.status}): ${detail.slice(0, 300)}`,
      response.status,
    );
  }
  if (response.status === 204) return null;
  return response.json();
}

/** Vom Mitgliederbereich angelegte Konten; nur diese werden verändert. */
export function isManagedAuthentikUser(user: AuthentikUser): boolean {
  return user.path === AUTHENTIK_MANAGED_USER_PATH;
}

export async function findAuthentikUserByEmail(email: string): Promise<AuthentikUser | null> {
  const config = requireConfig();
  const normalized = email.trim().toLowerCase();
  const data = userListSchema.parse(
    await request(config, "/core/users/", { query: { email: normalized } }),
  );
  return data.results.find((user) => user.email.toLowerCase() === normalized) ?? null;
}

type MemberIdentity = {
  userId: string;
  email: string;
  name: string | null;
};

/**
 * Sucht das Authentik-Konto zur E-Mail und legt es bei Bedarf an (ohne
 * Passwort). Konten außerhalb des Mitgliederbereich-Pfads (z. B. Admins der
 * Infrastruktur mit derselben Adresse) werden zurückgegeben, aber nie verändert.
 */
export async function ensureAuthentikUser(member: MemberIdentity): Promise<AuthentikUser> {
  const existing = await findAuthentikUserByEmail(member.email);
  if (existing) return existing;

  const config = requireConfig();
  const email = member.email.trim().toLowerCase();
  const created = await request(config, "/core/users/", {
    method: "POST",
    body: {
      username: email,
      name: member.name?.trim() || email,
      email,
      is_active: true,
      type: "internal",
      path: AUTHENTIK_MANAGED_USER_PATH,
      attributes: { mitgliederbereich: { userId: member.userId } },
    },
  });
  return authentikUserSchema.parse(created);
}

export async function setAuthentikPassword(user: AuthentikUser, password: string): Promise<void> {
  if (!isManagedAuthentikUser(user)) {
    throw new AuthentikApiError(
      `Konto ${user.username} wird nicht vom Mitgliederbereich verwaltet`,
    );
  }
  const config = requireConfig();
  await request(config, `/core/users/${user.pk}/set_password/`, {
    method: "POST",
    body: { password },
  });
}

let cachedEmailStage: { name: string; pk: string } | null = null;

async function resolveRecoveryEmailStage(config: AuthentikApiConfig): Promise<string> {
  if (cachedEmailStage?.name === config.recoveryEmailStage) return cachedEmailStage.pk;
  const data = emailStageListSchema.parse(
    await request(config, "/stages/email/", { query: { name: config.recoveryEmailStage } }),
  );
  const stage = data.results.find((entry) => entry.name === config.recoveryEmailStage);
  if (!stage) {
    throw new AuthentikApiError(`Email-Stage ${config.recoveryEmailStage} nicht gefunden`);
  }
  cachedEmailStage = { name: stage.name, pk: stage.pk };
  return stage.pk;
}

/**
 * Verschickt über Authentik die Mail "Passwort festlegen" (Theater-Recovery-Flow,
 * Link 2 Stunden gültig). Funktioniert für jedes Konto mit E-Mail-Adresse.
 */
export async function sendAuthentikPasswordEmail(user: AuthentikUser): Promise<void> {
  const config = requireConfig();
  const stagePk = await resolveRecoveryEmailStage(config);
  await request(config, `/core/users/${user.pk}/recovery_email/`, {
    method: "POST",
    query: { email_stage: stagePk },
  });
}
