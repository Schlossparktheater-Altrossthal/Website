"use client";

import { useEffect, useState } from 'react';
import { useAttendanceRealtime, usePresence } from '@/hooks/useRealtime';
import { RealtimeStatus } from '@/components/realtime-status';
import { toast } from 'sonner';

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
    setLastActivity(new Date());
    
    // Only show notifications for other users' changes
    if (event.userId !== currentUserId) {
      const statusText = {
        yes: 'zugesagt',
        no: 'abgesagt', 
        emergency: 'Notfall gemeldet'
      }[event.status] || event.status;

      toast.info(`${event.userName} hat ${statusText}`, {
        description: `Probe: ${rehearsalTitle}`,
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