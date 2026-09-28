"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useRealtime } from "@/hooks/useRealtime";
import type { RoomType } from "@/lib/realtime/types";

/**
 * Lädt die Seite neu, sobald der Live-Server meldet, dass sich das Protokoll eines Termins
 * geändert hat (Probenmodus auf einem anderen Gerät).
 */
export function useEventLiveRefresh(eventId: string) {
  const router = useRouter();
  const { socket, joinRoom, leaveRoom } = useRealtime();

  useEffect(() => {
    if (!socket) return;
    const room: RoomType = `rehearsal_${eventId}`;
    // Beim (Wieder-)Verbinden anmelden – ein Beitritt vor dem Verbinden ginge verloren. Nach
    // einer Unterbrechung zusätzlich neu laden, um Verpasstes nachzuholen.
    let connectedBefore = socket.connected;
    const join = () => {
      joinRoom(room);
      if (connectedBefore) router.refresh();
      connectedBefore = true;
    };
    if (socket.connected) joinRoom(room);
    const handle = (event: { rehearsalId: string; changes?: { protocol?: boolean } }) => {
      if (event.rehearsalId === eventId && event.changes?.protocol) router.refresh();
    };
    socket.on("connect", join);
    socket.on("rehearsal_updated", handle);
    return () => {
      socket.off("connect", join);
      socket.off("rehearsal_updated", handle);
      leaveRoom(room);
    };
  }, [socket, eventId, joinRoom, leaveRoom, router]);
}
