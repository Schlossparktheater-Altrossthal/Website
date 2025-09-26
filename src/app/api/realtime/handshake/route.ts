import { NextResponse } from 'next/server';
import { getSession } from '@/lib/rbac';
import {
  createHandshakeToken,
  resolveHandshakeSecret,
} from '@/lib/realtime/handshake';

export async function GET() {
  const secret = resolveHandshakeSecret();
  if (!secret) {
    console.error('[Realtime] Handshake secret is not configured.');
    return NextResponse.json({ error: 'Realtime server is not configured.' }, { status: 500 });
  }

  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
  }

  const token = createHandshakeToken({ userId, secret });
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
