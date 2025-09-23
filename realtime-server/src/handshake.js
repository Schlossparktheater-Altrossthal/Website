import { createHmac, timingSafeEqual } from 'node:crypto';

export function parseHandshakeToken(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [issuedAtRaw, expiresAtRaw, signature] = parts;
  const issuedAt = Number(issuedAtRaw);
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) return null;
  if (!signature || typeof signature !== 'string') return null;
  return { issuedAt, expiresAt, signature };
}

export function verifyHandshake({ userId, token, secret, now = Date.now }) {
  if (!secret) {
    return { ok: false, reason: 'Handshake secret not configured' };
  }
  if (typeof userId !== 'string' || !userId.trim()) {
    return { ok: false, reason: 'Missing userId' };
  }
  if (typeof token !== 'string' || !token.trim()) {
    return { ok: false, reason: 'Missing token' };
  }

  const parsed = parseHandshakeToken(token);
  if (!parsed) {
    return { ok: false, reason: 'Invalid token format' };
  }

  let currentTime = typeof now === 'function' ? now() : now;
  if (!Number.isFinite(currentTime)) {
    currentTime = Date.now();
  }

  if (parsed.expiresAt < currentTime) {
    return { ok: false, reason: 'Token expired' };
  }

  const base = `${userId}:${parsed.issuedAt}:${parsed.expiresAt}`;
  const expectedSignature = createHmac('sha256', secret).update(base).digest('hex');

  try {
    const providedBuffer = Buffer.from(parsed.signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    if (providedBuffer.length !== expectedBuffer.length) {
      return { ok: false, reason: 'Invalid token signature' };
    }
    if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
      return { ok: false, reason: 'Invalid token signature' };
    }
  } catch {
    return { ok: false, reason: 'Invalid token signature' };
  }

  return { ok: true, issuedAt: parsed.issuedAt, expiresAt: parsed.expiresAt };
}
