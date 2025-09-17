"use client";

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRealtime, usePresence, useNotificationRealtime } from '@/hooks/useRealtime';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Activity, 
  Calendar,
  Clock,
  Wifi,
  WifiOff,
  Bell,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from 'lucide-react';

interface OnlineUser {
  id: string;
  name: string;
  status: 'online' | 'idle' | 'away';
  lastSeen: Date;
}

interface RecentActivity {
  id: string;
  type: 'attendance' | 'rehearsal' | 'notification';
  message: string;
  timestamp: Date;
  userId?: string;
  userName?: string;
}

export function MembersDashboard() {
  const { data: session } = useSession();
  const { connectionStatus, isConnected } = useRealtime();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [stats, setStats] = useState({
    totalOnline: 0,
    totalMembers: 0,
    todayRehearsals: 0,
    unreadNotifications: 0,
  });

  // Mock data for demonstration (replace with real API calls)
  useEffect(() => {
    // Simulate fetching member statistics
    setStats({
      totalOnline: Math.floor(Math.random() * 15) + 1,
      totalMembers: 42,
      todayRehearsals: 2,
      unreadNotifications: 3,
    });

    // Simulate online users
    const mockUsers: OnlineUser[] = [
      { id: '1', name: 'Anna Müller', status: 'online', lastSeen: new Date() },
      { id: '2', name: 'Thomas Weber', status: 'online', lastSeen: new Date() },
      { id: '3', name: 'Sarah Schmidt', status: 'idle', lastSeen: new Date(Date.now() - 5 * 60 * 1000) },
      { id: '4', name: 'Michael Fischer', status: 'online', lastSeen: new Date() },
    ];
    setOnlineUsers(mockUsers);

    // Simulate recent activities
    const mockActivities: RecentActivity[] = [
      {
        id: '1',
        type: 'attendance',
        message: 'Anna Müller hat für die Probe "Romeo & Julia" zugesagt',
        timestamp: new Date(Date.now() - 2 * 60 * 1000),
        userId: '1',
        userName: 'Anna Müller'
      },
      {
        id: '2',
        type: 'rehearsal',
        message: 'Neue Probe "Hamlet Akt 3" wurde erstellt',
        timestamp: new Date(Date.now() - 10 * 60 * 1000),
      },
      {
        id: '3',
        type: 'attendance',
        message: 'Thomas Weber hat für die Probe "Macbeth" abgesagt',
        timestamp: new Date(Date.now() - 15 * 60 * 1000),
        userId: '2',
        userName: 'Thomas Weber'
      },
    ];
    setRecentActivities(mockActivities);
  }, []);

  // Listen to real-time notifications
  useNotificationRealtime((event) => {
    const newActivity: RecentActivity = {
      id: `notif_${Date.now()}`,
      type: 'notification',
      message: event.notification.title,
      timestamp: new Date(),
    };
    
    setRecentActivities(prev => [newActivity, ...prev].slice(0, 10));
    setStats(prev => ({ ...prev, unreadNotifications: prev.unreadNotifications + 1 }));
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <div className="w-2 h-2 bg-green-500 rounded-full" />;
      case 'idle':
        return <div className="w-2 h-2 bg-yellow-500 rounded-full" />;
      case 'away':
        return <div className="w-2 h-2 bg-gray-400 rounded-full" />;
      default:
        return <div className="w-2 h-2 bg-gray-300 rounded-full" />;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'attendance':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'rehearsal':
        return <Calendar className="h-4 w-4 text-blue-500" />;
      case 'notification':
        return <Bell className="h-4 w-4 text-purple-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'gerade eben';
    if (diffInSeconds < 3600) return `vor ${Math.floor(diffInSeconds / 60)} Min`;
    if (diffInSeconds < 86400) return `vor ${Math.floor(diffInSeconds / 3600)} Std`;
    return `vor ${Math.floor(diffInSeconds / 86400)} Tag(en)`;
  };

  if (!session?.user) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Bitte melden Sie sich an, um das Mitglieder-Dashboard zu sehen.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Mitglieder-Dashboard</h1>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <Wifi className="h-5 w-5 text-green-500" />
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                Live verbunden
              </Badge>
            </>
          ) : (
            <>
              <WifiOff className="h-5 w-5 text-red-500" />
              <Badge variant="destructive">Offline</Badge>
            </>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online Mitglieder</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.totalOnline}</div>
            <p className="text-xs text-muted-foreground">
              von {stats.totalMembers} Mitgliedern
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Heutige Proben</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayRehearsals}</div>
            <p className="text-xs text-muted-foreground">
              geplante Termine
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ungelesene Nachrichten</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.unreadNotifications}</div>
            <p className="text-xs text-muted-foreground">
              neue Benachrichtigungen
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verbindungsstatus</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {connectionStatus === 'connected' ? 'Online' : 'Offline'}
            </div>
            <p className="text-xs text-muted-foreground">
              Real-time Updates
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Online Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Online Mitglieder ({onlineUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {onlineUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Keine anderen Mitglieder online
                </p>
              ) : (
                onlineUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(user.status)}
                      <div>
                        <p className="font-medium text-sm">{user.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {user.status === 'online' ? 'Aktiv' : `Zuletzt gesehen: ${formatTimeAgo(user.lastSeen)}`}
                        </p>
                      </div>
                    </div>
                    <Badge variant={user.status === 'online' ? 'default' : 'secondary'} className="text-xs">
                      {user.status === 'online' ? 'Online' : 'Inaktiv'}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Aktuelle Aktivitäten
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivities.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Keine aktuellen Aktivitäten
                </p>
              ) : (
                recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg bg-gray-50">
                    {getActivityIcon(activity.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{activity.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                          {formatTimeAgo(activity.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Schnellzugriff</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button className="p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left">
              <Calendar className="h-6 w-6 mb-2 text-blue-500" />
              <p className="font-medium text-sm">Probenkalender</p>
              <p className="text-xs text-muted-foreground">Termine anzeigen</p>
            </button>
            
            <button className="p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left">
              <Users className="h-6 w-6 mb-2 text-green-500" />
              <p className="font-medium text-sm">Mitgliederliste</p>
              <p className="text-xs text-muted-foreground">Alle Mitglieder</p>
            </button>
            
            <button className="p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left">
              <Bell className="h-6 w-6 mb-2 text-purple-500" />
              <p className="font-medium text-sm">Nachrichten</p>
              <p className="text-xs text-muted-foreground">Benachrichtigungen</p>
            </button>
            
            <button className="p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left">
              <Activity className="h-6 w-6 mb-2 text-orange-500" />
              <p className="font-medium text-sm">Statistiken</p>
              <p className="text-xs text-muted-foreground">Aktivitätsübersicht</p>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}