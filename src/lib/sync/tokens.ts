import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { z } from "zod";

const TOKEN_VERSION = "v1" as const;
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

const syncTokenSchema = z.object({
  version: z.literal(TOKEN_VERSION),
  userId: z.string().min(1),
  issuedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().nonnegative(),
  nonce: z.string().min(1),
});

export type SyncTokenClaims = z.infer<typeof syncTokenSchema>;

function getSyncTokenSecret(): string {
  const secret = process.env.SYNC_TOKEN_SECRET ?? process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("SYNC_TOKEN_SECRET or AUTH_SECRET must be configured to sign sync tokens");
  }

  return secret;
}

function encodePayload(payload: SyncTokenClaims): { encoded: string; payloadBuffer: Buffer } {
  const payloadJson = JSON.stringify(payload);
  const payloadBuffer = Buffer.from(payloadJson, "utf8");
  const encoded = payloadBuffer.toString("base64url");
  return { encoded, payloadBuffer };
}

function decodePayload(encoded: string): SyncTokenClaims | null {
  try {
    const buffer = Buffer.from(encoded, "base64url");
    const json = buffer.toString("utf8");
    const parsed = JSON.parse(json);
    const result = syncTokenSchema.safeParse(parsed);

    if (!result.success) {
      return null;
    }

    return result.data;
  } catch {
    return null;
  }
}

function createSignature(encodedPayload: string): Buffer {
  const hmac = createHmac("sha256", getSyncTokenSecret());
  hmac.update(encodedPayload);
  return hmac.digest();
}

export function createSyncToken(
  userId: string,
  options: { ttlMs?: number } = {},
): string {
  if (!userId || userId.trim().length === 0) {
    throw new Error("Cannot create sync token without user id");
  }

  const now = Date.now();
  const ttl = typeof options.ttlMs === "number" && options.ttlMs > 0 ? options.ttlMs : DEFAULT_TTL_MS;
  const payload: SyncTokenClaims = {
    version: TOKEN_VERSION,
    userId,
    issuedAt: now,
    expiresAt: now + ttl,
    nonce: randomUUID(),
  };

  const { encoded } = encodePayload(payload);
  const signature = createSignature(encoded).toString("base64url");

  return `${encoded}.${signature}`;
}

export function verifySyncToken(token: string | null | undefined): SyncTokenClaims | null {
  if (!token || token.trim().length === 0) {
    return null;
  }

  const segments = token.split(".");

  if (segments.length !== 2) {
    return null;
  }

  const [encoded, providedSignature] = segments;

  if (!encoded || !providedSignature) {
    return null;
  }

  let providedBuffer: Buffer;
  try {
    providedBuffer = Buffer.from(providedSignature, "base64url");
  } catch {
    return null;
  }

  const expectedBuffer = createSignature(encoded);

  if (providedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  const payload = decodePayload(encoded);

  if (!payload) {
    return null;
  }

  if (payload.expiresAt <= Date.now()) {
    return null;
  }

  return payload;
}

