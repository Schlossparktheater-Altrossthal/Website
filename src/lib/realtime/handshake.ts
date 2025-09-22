import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TTL_SECONDS = 5 * 60;

export type HandshakeVerificationError =
  | 'missing_secret'
  | 'missing_token'
  | 'missing_user_id'
  | 'invalid_format'
  | 'invalid_timestamp'
  | 'invalid_signature'
  | 'expired';

export type HandshakeVerificationResult =
  | { valid: true; issuedAt: number; expiresAt: number }
  | { valid: false; reason: HandshakeVerificationError };

export function resolveHandshakeSecret(): string | null {
  const secret =
    process.env.REALTIME_HANDSHAKE_SECRET ||
    process.env.REALTIME_AUTH_TOKEN ||
    process.env.REALTIME_SERVER_TOKEN ||
    null;
  return secret && secret.trim() ? secret : null;
}

export function resolveHandshakeTtlSeconds(): number {
  const raw = Number(process.env.REALTIME_HANDSHAKE_TTL ?? DEFAULT_TTL_SECONDS);
  if (Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }
  return DEFAULT_TTL_SECONDS;
}

function computeSignature(userId: string, issuedAt: number, expiresAt: number, secret: string): string {
  const base = `${userId}:${issuedAt}:${expiresAt}`;
  return createHmac('sha256', secret).update(base).digest('hex');
}

export function createHandshakeToken({
  userId,
  secret,
  issuedAt = Date.now(),
  ttlSeconds,
}: {
  userId: string;
  secret: string;
  issuedAt?: number;
  ttlSeconds?: number;
}): { token: string; issuedAt: number; expiresAt: number } {
  const referenceIssuedAt = Math.floor(issuedAt);
  const resolvedTtl =
    typeof ttlSeconds === 'number' && Number.isFinite(ttlSeconds) && ttlSeconds > 0
      ? Math.floor(ttlSeconds)
      : resolveHandshakeTtlSeconds();
  const expiresAt = referenceIssuedAt + resolvedTtl * 1000;
  const signature = computeSignature(userId, referenceIssuedAt, expiresAt, secret);
  return {
    token: `${referenceIssuedAt}.${expiresAt}.${signature}`,
    issuedAt: referenceIssuedAt,
    expiresAt,
  };
}

export function verifyHandshakeToken({
  token,
  userId,
  secret,
  now = Date.now(),
}: {
  token?: string;
  userId?: string;
  secret: string | null;
  now?: number;
}): HandshakeVerificationResult {
  if (!secret) {
    return { valid: false, reason: 'missing_secret' };
  }

  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'missing_token' };
  }

  if (!userId || typeof userId !== 'string') {
    return { valid: false, reason: 'missing_user_id' };
  }

  const [issuedAtRaw, expiresAtRaw, providedSignature] = token.split('.');
  if (!issuedAtRaw || !expiresAtRaw || !providedSignature) {
    return { valid: false, reason: 'invalid_format' };
  }

  const issuedAt = Number(issuedAtRaw);
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt < issuedAt) {
    return { valid: false, reason: 'invalid_timestamp' };
  }

  const expectedSignature = computeSignature(userId, issuedAt, expiresAt, secret);

  if (providedSignature.length !== expectedSignature.length) {
    return { valid: false, reason: 'invalid_signature' };
  }

  const providedBuffer = Buffer.from(providedSignature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (providedBuffer.length !== expectedBuffer.length) {
    return { valid: false, reason: 'invalid_signature' };
  }

  let signatureMatches = false;
  try {
    signatureMatches = timingSafeEqual(providedBuffer, expectedBuffer);
  } catch {
    signatureMatches = false;
  }

  if (!signatureMatches) {
    return { valid: false, reason: 'invalid_signature' };
  }

  if (expiresAt < now) {
    return { valid: false, reason: 'expired' };
  }

  return { valid: true, issuedAt, expiresAt };
}
