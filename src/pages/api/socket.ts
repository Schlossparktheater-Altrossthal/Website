import { NextApiRequest, NextApiResponse } from "next";
import { realtimeService } from "@/lib/realtime/service";

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse & { socket: { server: any } },
) {
  // Type assertion to access the server property
  const server = (res as any).socket?.server;
  
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