import type { NextApiRequest, NextApiResponse } from "next";
import type { Server as HTTPServer } from "http";
import type { Socket } from "net";
import type { Server as IOServer } from "socket.io";
import { realtimeService } from "@/lib/realtime/service";

type NextApiResponseWithSocket = NextApiResponse & {
  socket: Socket & {
    server: HTTPServer & {
      io?: IOServer;
    };
  };
};

export default function handler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  const server = res.socket.server;

  if (!server) {
    return res.status(500).json({ error: 'Server not available' });
  }

  if (server.io) {
    console.log("Socket.IO server already running");
  } else {
    console.log("Initializing Socket.IO server...");

    try {
      const io = realtimeService.initialize(server);
      server.io = io;
      console.log("Socket.IO server initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Socket.IO:", error);
      return res.status(500).json({ error: 'Failed to initialize Socket.IO' });
    }
  }

  res.end();
}

export const config = {
  api: {
    bodyParser: false,
  },
};