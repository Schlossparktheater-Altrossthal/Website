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
  date_joined: z.string(),
  password_change_date: z.string().nullable(),
  attributes: z.record(z.string(), z.unknown()).default({}),
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

/** Profil-ID im Mitgliederbereich (Attribut `mitgliederbereich.userId`). */
export function getAuthentikMemberId(user: AuthentikUser): string | null {
  const section = user.attributes.mitgliederbereich;
  if (typeof section !== "object" || section === null || !("userId" in section)) return null;
  return typeof section.userId === "string" ? section.userId : null;
}

/** Toleranz zwischen Anlegen des Kontos und dem ersten Setzen des Passworts. */
const PASSWORD_SET_ON_CREATION_TOLERANCE_MS = 60 * 1000;

/**
 * true, wenn das Passwort in Authentik erst nach dem Anlegen des Kontos gesetzt
 * wurde (Passwort-Mail, Authentik-Einstellungen oder frühere Übernahme).
 */
export function hasAuthentikPasswordSinceCreation(user: AuthentikUser): boolean {
  if (!user.password_change_date) return false;
  const changed = Date.parse(user.password_change_date);
  const joined = Date.parse(user.date_joined);
  if (Number.isNaN(changed) || Number.isNaN(joined)) return false;
  return changed - joined > PASSWORD_SET_ON_CREATION_TOLERANCE_MS;
}

export async function findAuthentikUserByMemberId(userId: string): Promise<AuthentikUser | null> {
  const config = requireConfig();
  const data = userListSchema.parse(
    await request(config, "/core/users/", {
      query: { attributes: JSON.stringify({ mitgliederbereich__userId: userId }) },
    }),
  );
  return (
    data.results.find(
      (user) => isManagedAuthentikUser(user) && getAuthentikMemberId(user) === userId,
    ) ?? null
  );
}

export async function findAuthentikUserByEmail(email: string): Promise<AuthentikUser | null> {
  const config = requireConfig();
  const normalized = email.trim().toLowerCase();
  const data = userListSchema.parse(
    await request(config, "/core/users/", { query: { email: normalized } }),
  );
  return data.results.find((user) => user.email.toLowerCase() === normalized) ?? null;
}

export type MemberIdentity = {
  userId: string;
  email: string;
  name: string | null;
};

type AuthentikUserUpdate = Partial<
  Pick<AuthentikUser, "username" | "name" | "email" | "is_active" | "attributes">
>;

async function updateManagedUser(
  user: AuthentikUser,
  changes: AuthentikUserUpdate,
): Promise<AuthentikUser> {
  if (!isManagedAuthentikUser(user)) {
    throw new AuthentikApiError(
      `Konto ${user.username} wird nicht vom Mitgliederbereich verwaltet`,
    );
  }
  const config = requireConfig();
  const updated = await request(config, `/core/users/${user.pk}/`, {
    method: "PATCH",
    body: changes,
  });
  return authentikUserSchema.parse(updated);
}

function displayNameFor(member: MemberIdentity, email: string): string {
  return member.name?.trim() || email;
}

/**
 * Gleicht ein verwaltetes Konto mit dem Mitglied ab: E-Mail, Benutzername
 * (= E-Mail) und Name kommen aus dem Mitgliederbereich. Konten außerhalb des
 * Mitgliederbereich-Pfads bleiben unverändert.
 */
export async function reconcileAuthentikUser(
  user: AuthentikUser,
  member: MemberIdentity,
): Promise<AuthentikUser> {
  if (!isManagedAuthentikUser(user)) return user;
  const email = member.email.trim().toLowerCase();
  const name = displayNameFor(member, email);
  const changes: AuthentikUserUpdate = {};
  if (user.email !== email) changes.email = email;
  if (user.username !== email) changes.username = email;
  if (user.name !== name) changes.name = name;
  // Konto eines früher gelöschten Profils mit derselben Adresse wird übernommen.
  if (!user.is_active) changes.is_active = true;
  if (getAuthentikMemberId(user) !== member.userId) {
    changes.attributes = { ...user.attributes, mitgliederbereich: { userId: member.userId } };
  }
  if (Object.keys(changes).length === 0) return user;
  return updateManagedUser(user, changes);
}

/**
 * Sucht das Authentik-Konto eines Mitglieds: zuerst über die Profil-ID (bleibt
 * bei E-Mail-Änderungen stabil), dann über die E-Mail.
 */
export type MemberLookupOptions = {
  /**
   * Prüft, ob eine fremde Profil-ID im Mitgliederbereich noch existiert. Gehört
   * ein Konto mit derselben Adresse zu einem Profil, das es nicht mehr gibt,
   * wird es übernommen statt den Vorgang dauerhaft zu blockieren.
   */
  isKnownMember?: (userId: string) => Promise<boolean>;
};

export async function findAuthentikUserForMember(
  member: MemberIdentity,
  options: MemberLookupOptions = {},
): Promise<AuthentikUser | null> {
  const byMemberId = await findAuthentikUserByMemberId(member.userId);
  if (byMemberId) return byMemberId;
  const byEmail = await findAuthentikUserByEmail(member.email);
  if (!byEmail) return null;
  const otherMemberId = getAuthentikMemberId(byEmail);
  if (
    isManagedAuthentikUser(byEmail) &&
    otherMemberId &&
    otherMemberId !== member.userId &&
    (!options.isKnownMember || (await options.isKnownMember(otherMemberId)))
  ) {
    throw new AuthentikApiError(
      `Konto ${byEmail.username} gehört zu einem anderen Mitglied (${otherMemberId})`,
    );
  }
  return byEmail;
}

/**
 * Sucht das Authentik-Konto des Mitglieds, gleicht es ab oder legt es bei
 * Bedarf an (ohne Passwort). Konten außerhalb des Mitgliederbereich-Pfads
 * (z. B. Admins der Infrastruktur mit derselben Adresse) werden zurückgegeben,
 * aber nie verändert.
 */
export async function ensureAuthentikUser(
  member: MemberIdentity,
  options: MemberLookupOptions = {},
): Promise<{ user: AuthentikUser; created: boolean; claimed: boolean }> {
  const existing = await findAuthentikUserForMember(member, options);
  if (existing) {
    // "claimed": verwaltetes Konto, das bisher keinem oder einem nicht mehr
    // existierenden Profil gehörte; sein Passwort stammt nicht vom Mitglied.
    const claimed =
      isManagedAuthentikUser(existing) && getAuthentikMemberId(existing) !== member.userId;
    return {
      user: await reconcileAuthentikUser(existing, member),
      created: false,
      claimed,
    };
  }

  const config = requireConfig();
  const email = member.email.trim().toLowerCase();
  const created = await request(config, "/core/users/", {
    method: "POST",
    body: {
      username: email,
      name: displayNameFor(member, email),
      email,
      is_active: true,
      type: "internal",
      path: AUTHENTIK_MANAGED_USER_PATH,
      attributes: { mitgliederbereich: { userId: member.userId } },
    },
  });
  return { user: authentikUserSchema.parse(created), created: true, claimed: false };
}

/**
 * Gelöschte Mitglieder: Konto in Authentik deaktivieren statt löschen, damit
 * Verknüpfungen in anderen Diensten nachvollziehbar bleiben. Die Profil-ID
 * wird entfernt; legt jemand mit derselben Adresse später ein neues Profil
 * an, übernimmt es das Konto wieder.
 */
export async function deactivateAuthentikUser(user: AuthentikUser): Promise<void> {
  if (!isManagedAuthentikUser(user)) return;
  const memberId = getAuthentikMemberId(user);
  await updateManagedUser(user, {
    is_active: false,
    attributes: {
      ...user.attributes,
      mitgliederbereich: memberId ? { deletedUserId: memberId } : {},
    },
  });
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
