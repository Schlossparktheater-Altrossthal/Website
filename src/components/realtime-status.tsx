"use client";

import { useState } from 'react';
import { useAttendanceRealtime, usePresence, useRealtime } from '@/hooks/useRealtime';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Wifi, 
  WifiOff, 
  Users, 
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle 
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_TEXT: Record<string, string> = {
  yes: 'Zusage',
  no: 'Absage',
  emergency: 'Notfall',
};

function getStatusText(status: string | null | undefined): string {
  if (!status) {
    return 'Unbekannt';
  }
  return STATUS_TEXT[status] ?? status;
}

function formatUserId(userId?: string | null): string {
  return userId ? `Mitglied ${userId}` : 'Ein Mitglied';
}

interface RealtimeStatusProps {
  rehearsalId?: string;
  showPresence?: boolean;
}

export function RealtimeStatus({ rehearsalId, showPresence = true }: RealtimeStatusProps) {
  const { connectionStatus, isConnected, reconnect } = useRealtime();
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // Handle attendance updates if rehearsalId is provided
  useAttendanceRealtime(
    rehearsalId || null,
    (event) => {
      const occurredAt = event.timestamp ? new Date(event.timestamp) : new Date();
      setLastUpdate(occurredAt);

      const statusLabel = getStatusText(event.status);
      const actorLabel = formatUserId(event.actorUserId);
      const targetLabel = event.targetUserId ? ` für ${formatUserId(event.targetUserId)}` : '';
      const descriptionParts = [
        event.rehearsalId ? `Probe: ${event.rehearsalId}` : null,
        event.comment ? `Kommentar: ${event.comment}` : null,
      ].filter(Boolean) as string[];

      toast.info(
        `${actorLabel} hat die Anwesenheit${targetLabel} auf „${statusLabel}“ gesetzt`,
        {
          description: descriptionParts.length ? descriptionParts.join(' · ') : undefined,
          duration: 3000,
        }
      );
    }
  );

  // Handle user presence if enabled and rehearsalId provided
  const presentUsers = usePresence(
    showPresence && rehearsalId ? rehearsalId : null,
    (event) => {
      const action = event.action === 'join' ? 'ist online gekommen' : 'ist offline gegangen';
      toast.info(`${event.user.name} ${action}`);
    }
  );

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'connecting':
        return <Clock className="h-4 w-4 text-yellow-500 animate-pulse" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-500" />;
    }
  };

  const getConnectionBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Badge variant="secondary" className="text-green-700 bg-green-100">Verbunden</Badge>;
      case 'connecting':
        return <Badge variant="secondary" className="text-yellow-700 bg-yellow-100">Verbinde...</Badge>;
      case 'error':
        return <Badge variant="destructive">Fehler</Badge>;
      default:
        return <Badge variant="outline">Getrennt</Badge>;
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          {getConnectionIcon()}
          Real-Time Status
          {getConnectionBadge()}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Connection Status */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Verbindung:</span>
          <span className={`font-medium ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
            {isConnected ? 'Aktiv' : 'Getrennt'}
          </span>
        </div>

        {/* Last Update */}
        {lastUpdate && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Letzte Aktualisierung:</span>
            <span className="font-medium">
              {lastUpdate.toLocaleTimeString('de-DE', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
              })}
            </span>
          </div>
        )}

        {/* Present Users */}
        {showPresence && rehearsalId && (
          <div className="border-t pt-3">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                Online ({presentUsers.length})
              </span>
            </div>
            
            <div className="space-y-1">
              {presentUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Keine anderen Benutzer online
                </p>
              ) : (
                presentUsers.map((user) => (
                  <div key={user.id} className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="text-xs">{user.name}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Reconnect Button */}
        {!isConnected && (
          <button
            onClick={reconnect}
            className="w-full mt-3 px-3 py-2 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md transition-colors"
          >
            Neu verbinden
          </button>
        )}
      </CardContent>
    </Card>
  );
}

// Component for showing attendance changes in real-time
interface AttendanceUpdatesProps {
  rehearsalId: string;
}

export function AttendanceUpdates({ rehearsalId }: AttendanceUpdatesProps) {
  const [recentUpdates, setRecentUpdates] = useState<Array<{
    id: string;
    actorUserId?: string;
    targetUserId: string;
    status: string | null;
    timestamp: Date;
    rehearsalId: string;
    comment?: string | null;
  }>>([]);

  useAttendanceRealtime(rehearsalId, (event) => {
    setRecentUpdates((prev) => [
      {
        id: `${event.rehearsalId}-${event.timestamp}`,
        actorUserId: event.actorUserId,
        targetUserId: event.targetUserId,
        status: event.status ?? null,
        timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
        rehearsalId: event.rehearsalId,
        comment: event.comment,
      },
      ...prev,
    ].slice(0, 10));
  });

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'yes':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'no':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'emergency':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      default:
        return null;
    }
  };

  if (recentUpdates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Live-Updates</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Keine aktuellen Updates
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Live-Updates</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {recentUpdates.map((update) => (
          <div key={update.id} className="flex items-start gap-2 rounded-lg bg-gray-50 p-2">
            {getStatusIcon(update.status)}
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-sm">
                <span className="font-medium">{formatUserId(update.actorUserId)}</span>{' '}
                hat die Anwesenheit
                {update.targetUserId ? (
                  <>
                    {' '}für <span className="font-medium">{formatUserId(update.targetUserId)}</span>
                  </>
                ) : null}{' '}
                auf <span className="font-medium">{getStatusText(update.status)}</span> gesetzt
              </p>
              <p className="text-xs text-muted-foreground">
                {update.timestamp.toLocaleTimeString('de-DE', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {update.rehearsalId ? ` · Probe ${update.rehearsalId}` : ''}
              </p>
              {update.comment ? (
                <p className="text-xs text-muted-foreground">Kommentar: {update.comment}</p>
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}