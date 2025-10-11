import { NextResponse } from 'next/server';
import type { Server as HTTPServer } from 'node:http';
import { getBuiltinRequestContext } from 'next/dist/server/after/builtin-request-context';
import { realtimeService } from '@/lib/realtime/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type NodeLikeWithServer = { socket?: { server?: HTTPServer } } | null | undefined;

interface BuiltinRequestContextValue {
  req?:
    | NodeLikeWithServer
    | { originalRequest?: NodeLikeWithServer };
  res?:
    | NodeLikeWithServer
    | { originalResponse?: NodeLikeWithServer };
}

function unwrapNodeLike(source: NodeLikeWithServer | { originalRequest?: NodeLikeWithServer } | { originalResponse?: NodeLikeWithServer } | null | undefined): NodeLikeWithServer {
  if (!source) {
    return null;
  }

  if ('originalResponse' in (source as object) && source && typeof source === 'object') {
    const candidate = (source as { originalResponse?: NodeLikeWithServer }).originalResponse;
    return candidate ?? (source as NodeLikeWithServer);
  }

  if ('originalRequest' in (source as object) && source && typeof source === 'object') {
    const candidate = (source as { originalRequest?: NodeLikeWithServer }).originalRequest;
    return candidate ?? (source as NodeLikeWithServer);
  }

  return source as NodeLikeWithServer;
}

function extractHttpServer(): HTTPServer | null {
  try {
    const context = getBuiltinRequestContext?.() as BuiltinRequestContextValue | undefined;
    if (!context) {
      return null;
    }

    const response = unwrapNodeLike(context.res);
    if (response?.socket?.server) {
      return response.socket.server;
    }

    const request = unwrapNodeLike(context.req);
    if (request?.socket?.server) {
      return request.socket.server;
    }

    return null;
  } catch (error) {
    console.error('[Realtime] Failed to resolve builtin request context', error);
    return null;
  }
}

async function ensureSocketServer(): Promise<{ status: number; body: Record<string, unknown> }> {
  const server = extractHttpServer();
  if (!server) {
    return {
      status: 500,
      body: { error: 'Socket server is not available' },
    };
  }

  try {
    realtimeService.initialize(server);
    return {
      status: 200,
      body: { ok: true },
    };
  } catch (error) {
    console.error('[Realtime] Failed to initialize Socket.IO server', error);
    return {
      status: 500,
      body: { error: 'Failed to initialize Socket.IO server' },
    };
  }
}

export async function GET() {
  const { status, body } = await ensureSocketServer();
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
