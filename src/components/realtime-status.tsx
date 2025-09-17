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
      setLastUpdate(new Date());
      toast.info(
        `${event.userName} hat Anwesenheit auf "${event.status}" geändert`,
        { 
          description: `Probe: ${event.rehearsalTitle}`,
          duration: 3000 
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
    userName: string;
    status: string;
    timestamp: Date;
    rehearsalTitle: string;
  }>>([]);

  useAttendanceRealtime(rehearsalId, (event) => {
    setRecentUpdates(prev => [{
      id: `${event.userId}-${Date.now()}`,
      userName: event.userName,
      status: event.status,
      timestamp: new Date(),
      rehearsalTitle: event.rehearsalTitle,
    }, ...prev].slice(0, 10)); // Keep only last 10 updates
  });

  const getStatusIcon = (status: string) => {
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

  const getStatusText = (status: string) => {
    switch (status) {
      case 'yes': return 'Zusage';
      case 'no': return 'Absage';
      case 'emergency': return 'Notfall';
      default: return status;
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
          <div key={update.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
            {getStatusIcon(update.status)}
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-medium">{update.userName}</span>
                {' → '}
                <span className="font-medium">{getStatusText(update.status)}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {update.timestamp.toLocaleTimeString('de-DE', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}