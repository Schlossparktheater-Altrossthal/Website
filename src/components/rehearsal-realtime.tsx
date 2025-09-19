"use client";

import { useState } from 'react';
import { useAttendanceRealtime, usePresence } from '@/hooks/useRealtime';
import { RealtimeStatus } from '@/components/realtime-status';
import { toast } from 'sonner';

const ATTENDANCE_STATUS_MESSAGES: Record<string, string> = {
  yes: 'zugesagt',
  no: 'abgesagt',
  emergency: 'einen Notfall gemeldet',
};

const formatUserId = (userId?: string | null): string => (userId ? `Mitglied ${userId}` : 'Ein Mitglied');

interface RehearsalRealtimeProps {
  rehearsalId: string;
  rehearsalTitle: string;
  currentUserId?: string;
  onAttendanceUpdate?: () => void;
}

export function RehearsalRealtime({ 
  rehearsalId, 
  rehearsalTitle, 
  currentUserId,
  onAttendanceUpdate 
}: RehearsalRealtimeProps) {
  const [lastActivity, setLastActivity] = useState<Date | null>(null);

  // Handle real-time attendance updates
  useAttendanceRealtime(rehearsalId, (event) => {
    const occurredAt = event.timestamp ? new Date(event.timestamp) : new Date();
    setLastActivity(occurredAt);

    // Only show notifications for other users' changes
    if (event.actorUserId !== currentUserId) {
      const statusMessage = event.status
        ? ATTENDANCE_STATUS_MESSAGES[event.status] ?? `den Status auf ${event.status} gesetzt`
        : 'die Anwesenheit aktualisiert';
      const targetLabel = event.targetUserId ? ` für ${formatUserId(event.targetUserId)}` : '';
      const descriptionParts = [
        `Probe: ${rehearsalTitle}`,
        event.comment ? `Kommentar: ${event.comment}` : null,
      ].filter(Boolean) as string[];

      toast.info(`${formatUserId(event.actorUserId)} hat${targetLabel} ${statusMessage}`, {
        description: descriptionParts.join(' · ') || undefined,
        duration: 4000,
      });
    }

    // Trigger refresh if callback provided
    onAttendanceUpdate?.();
  });

  // Handle user presence
  const presentUsers = usePresence(rehearsalId, (event) => {
    // Only show presence notifications if it's not the current user
    if (event.user.id !== currentUserId) {
      const actionText = event.action === 'join' ? 'ist beigetreten' : 'hat verlassen';
      toast.success(`${event.user.name} ${actionText}`, {
        description: 'Proben-Raum',
        duration: 2000,
      });
    }
  });

  return (
    <div className="space-y-4">
      {/* Real-time status indicator */}
      <RealtimeStatus 
        rehearsalId={rehearsalId}
        showPresence={true}
      />

      {/* Activity indicator */}
      {lastActivity && (
        <div className="text-xs text-muted-foreground">
          Letzte Aktivität: {lastActivity.toLocaleTimeString('de-DE')}
        </div>
      )}

      {/* Present users summary */}
      {presentUsers.length > 0 && (
        <div className="text-sm">
          <span className="text-muted-foreground">Online: </span>
          <span className="text-green-600">
            {presentUsers.map(u => u.name).join(', ')}
          </span>
        </div>
      )}
    </div>
  );
}

// Provider component to wrap rehearsal-related pages
interface RehearsalRealtimeProviderProps {
  children: React.ReactNode;
  rehearsalId: string;
  rehearsalTitle: string;
  showStatus?: boolean;
}

export function RehearsalRealtimeProvider({ 
  children, 
  rehearsalId, 
  rehearsalTitle,
  showStatus = true 
}: RehearsalRealtimeProviderProps) {
  return (
    <div className="space-y-4">
      {showStatus && (
        <RehearsalRealtime 
          rehearsalId={rehearsalId}
          rehearsalTitle={rehearsalTitle}
        />
      )}
      {children}
    </div>
  );
}