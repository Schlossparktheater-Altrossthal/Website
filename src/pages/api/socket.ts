import type { NextApiRequest, NextApiResponse } from 'next';
import type { Server as HTTPServer } from 'node:http';
import { realtimeService } from '@/lib/realtime/service';

type SocketServerResponse = NextApiResponse<{ ok: true } | { error: string }> & {
  socket: NextApiResponse['socket'] & { server?: HTTPServer };
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(_req: NextApiRequest, res: SocketServerResponse) {
  const server: HTTPServer | null | undefined = res.socket?.server;

  if (!server) {
    res.status(500).json({ error: 'Socket server is not available' });
    return;
  }

  try {
    realtimeService.initialize(server);
  } catch (error) {
    console.error('[Realtime] Failed to initialize Socket.IO server', error);
    res.status(500).json({ error: 'Failed to initialize Socket.IO server' });
    return;
  }

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ ok: true });
}
