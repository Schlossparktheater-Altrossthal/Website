import { createHash, randomBytes } from "node:crypto";
import type { EmailConfig } from "next-auth/providers/email";
import { prisma } from "@/lib/prisma";
import { getAuthSecret } from "@/lib/auth-secret";

export const MAGIC_LINK_SUCCESS_MESSAGE =
  "Falls ein Konto mit dieser E-Mail existiert, erhältst du in Kürze eine E-Mail.";
export const MAGIC_LINK_RATE_LIMIT_MESSAGE = "Zu viele Versuche, bitte später erneut versuchen";
export const MAGIC_LINK_INVALID_MESSAGE = "Dieser Link ist ungültig oder abgelaufen";

const ONE_HOUR_IN_MS = 60 * 60 * 1000;
const EMAIL_LIMIT = 3;
const IP_LIMIT = 10;
const MAGIC_LINK_MAX_AGE_IN_SECONDS = 24 * 60 * 60;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

type MagicLinkEmailProvider = {
  server?: EmailConfig["server"];
  from?: string;
};

type SendMagicLinkEmailParams = {
  identifier: string;
  url: string;
  provider: MagicLinkEmailProvider;
};

const emailAttempts = new Map<string, RateLimitBucket>();
const ipAttempts = new Map<string, RateLimitBucket>();

export function normalizeMagicLinkEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getResetRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return forwardedFor || realIp || "unknown";
}

function pruneExpiredAttempts(now: number) {
  for (const [key, bucket] of emailAttempts.entries()) {
    if (bucket.resetAt <= now) emailAttempts.delete(key);
  }
  for (const [key, bucket] of ipAttempts.entries()) {
    if (bucket.resetAt <= now) ipAttempts.delete(key);
  }
}

function incrementBucket(
  map: Map<string, RateLimitBucket>,
  key: string,
  limit: number,
  now: number,
) {
  const existing = map.get(key);
  const bucket =
    existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + ONE_HOUR_IN_MS };
  bucket.count += 1;
  map.set(key, bucket);

  return {
    allowed: bucket.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

export function recordMagicLinkAttempt(
  email: string,
  ip: string,
  now = Date.now(),
): RateLimitResult {
  pruneExpiredAttempts(now);

  const emailResult = incrementBucket(
    emailAttempts,
    `email:${normalizeMagicLinkEmail(email)}`,
    EMAIL_LIMIT,
    now,
  );
  const ipResult = incrementBucket(ipAttempts, `ip:${ip}`, IP_LIMIT, now);

  if (emailResult.allowed && ipResult.allowed) {
    return { allowed: true };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(emailResult.retryAfterSeconds, ipResult.retryAfterSeconds),
  };
}

export async function sendMagicLinkEmail({ identifier, url, provider }: SendMagicLinkEmailParams) {
  if (!provider.server || process.env.NODE_ENV !== "production") {
    console.log("[DEV Magic Link]", identifier, url);
    return;
  }

  console.log("[MAGIC LINK REQUEST]", identifier);
  const { createTransport } = await import("nodemailer");
  const transport = createTransport(provider.server);
  await transport.sendMail({
    to: identifier,
    from: provider.from,
    subject: "Passwort zurücksetzen – Sommertheater Altroßthal",
    text: `Sommertheater Altroßthal\n\nPasswort zurücksetzen\n\nKlicke auf den Link, um ein neues Passwort festzulegen. Der Link ist 24 Stunden gültig.\n\n${url}\n\nFalls du diese E-Mail nicht angefordert hast, kannst du sie ignorieren.`,
    html: `
            <div style="background:#0d1117;padding:32px 16px;font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#ffffff;">
              <div style="max-width:560px;margin:0 auto;background:#111827;border:1px solid #1f2937;border-radius:16px;padding:32px;">
                <p style="margin:0 0 20px 0;font-size:24px;line-height:1.3;font-weight:700;color:#f97316;">Sommertheater Altroßthal</p>
                <h1 style="margin:0 0 16px 0;font-size:28px;line-height:1.2;font-weight:700;color:#ffffff;">Passwort zurücksetzen</h1>
                <p style="margin:0 0 28px 0;font-size:16px;line-height:1.6;color:#ffffff;">Klicke auf den Button unten, um ein neues Passwort festzulegen. Der Link ist 24 Stunden gültig.</p>
                <a href="${url}" style="display:inline-block;background:#f97316;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:14px 24px;border-radius:10px;">Neues Passwort festlegen</a>
                <p style="margin:28px 0 0 0;font-size:13px;line-height:1.5;color:#d1d5db;">Falls du diese E-Mail nicht angefordert hast, kannst du sie ignorieren.</p>
              </div>
            </div>
          `,
  });
  console.log("[MAGIC LINK SENT]", identifier);
}

export function createMagicLinkToken() {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: hashMagicLinkToken(token),
  };
}

export function hashMagicLinkToken(token: string) {
  return createHash("sha256").update(`${token}${getAuthSecret()}`).digest("hex");
}

export function createMagicLinkUrl(requestUrl: string, identifier: string, token: string) {
  const baseUrl = new URL(requestUrl).origin;
  const params = new URLSearchParams({
    callbackUrl: `${baseUrl}/reset-password`,
    token,
    email: identifier,
  });
  return `${baseUrl}/api/auth/callback/email?${params}`;
}

export async function createAndSendMagicLink(requestUrl: string, identifier: string) {
  const { token, tokenHash } = createMagicLinkToken();
  const expires = new Date(Date.now() + MAGIC_LINK_MAX_AGE_IN_SECONDS * 1000);
  const url = createMagicLinkUrl(requestUrl, identifier, token);

  await prisma.verificationToken.create({
    data: {
      identifier,
      token: tokenHash,
      expires,
    },
  });

  await sendMagicLinkEmail({
    identifier,
    url,
    provider: {
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
    },
  });
}
