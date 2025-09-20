import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createHmac } from 'node:crypto';

import { authOptions } from '@/lib/auth';

const DEFAULT_TTL_SECONDS = 5 * 60;

function getHandshakeSecret(): string | null {
  const secret =
    process.env.REALTIME_HANDSHAKE_SECRET ||
    process.env.REALTIME_AUTH_TOKEN ||
    process.env.REALTIME_SERVER_TOKEN ||
    null;
  return secret && secret.trim() ? secret : null;
}

function resolveTtl(): number {
  const raw = Number(process.env.REALTIME_HANDSHAKE_TTL ?? DEFAULT_TTL_SECONDS);
  if (Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }
  return DEFAULT_TTL_SECONDS;
}

function createHandshakeToken(userId: string, secret: string) {
  const issuedAt = Date.now();
  const ttlSeconds = resolveTtl();
  const expiresAt = issuedAt + ttlSeconds * 1000;
  const base = `${userId}:${issuedAt}:${expiresAt}`;
  const signature = createHmac('sha256', secret).update(base).digest('hex');
  const token = `${issuedAt}.${expiresAt}.${signature}`;
  return { token, issuedAt, expiresAt };
}

export async function GET() {
  const secret = getHandshakeSecret();
  if (!secret) {
    console.error('[Realtime] Handshake secret is not configured.');
    return NextResponse.json({ error: 'Realtime server is not configured.' }, { status: 500 });
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const token = createHandshakeToken(userId, secret);
  const payload = {
    token: token.token,
    issuedAt: token.issuedAt,
    expiresAt: token.expiresAt,
    userId,
    userName: session.user?.name ?? null,
  };

  return NextResponse.json(payload, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
