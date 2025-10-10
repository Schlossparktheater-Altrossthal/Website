export type DevDashboardActivity = {
  id: string;
  type: "notification" | "rehearsal";
  message: string;
  timestamp: string;
};

export type DevDashboardRehearsal = {
  id: string;
  title: string;
  start: string;
};

export const DEV_DASHBOARD_OVERVIEW_FIXTURE = {
  offline: true,
  stats: {
    totalMembers: 128,
    rehearsalsThisWeek: 5,
    unreadNotifications: 3,
    totalRehearsalsThisMonth: 18,
  },
  upcomingRehearsals: [
    {
      id: "reh_1",
      title: "Szenenprobe Akt 2",
      start: "2024-09-18T17:30:00.000Z",
    },
    {
      id: "reh_2",
      title: "Ensemble Warm-up",
      start: "2024-09-20T16:00:00.000Z",
    },
  ] satisfies DevDashboardRehearsal[],
  recentActivities: [
    {
      id: "notif_1",
      type: "notification",
      message: "Neue Regie-Notizen im Mitgliederbereich",
      timestamp: "2024-09-16T08:45:00.000Z",
    },
    {
      id: "rehearsal_2",
      type: "rehearsal",
      message: "Neue Probe: Chor Gesamt",
      timestamp: "2024-09-15T18:30:00.000Z",
    },
    {
      id: "notif_2",
      type: "notification",
      message: "Kostümfitting Termine aktualisiert",
      timestamp: "2024-09-14T11:15:00.000Z",
    },
  ] satisfies DevDashboardActivity[],
  finalRehearsalWeek: {
    showId: "show_demo_2024",
    title: "Sommernachtstraum",
    year: 2024,
    startDate: "2024-10-07T08:00:00.000Z",
    endDate: "2024-10-13T20:00:00.000Z",
  },
  profileCompletion: {
    complete: false,
    completed: 3,
    total: 5,
  },
  activeProduction: {
    id: "show_demo_2024",
    title: "Sommernachtstraum",
    year: 2024,
  },
  productionMemberships: [
    {
      showId: "show_demo_2024",
      title: "Sommernachtstraum",
      year: 2024,
      joinedAt: "2024-03-01T09:00:00.000Z",
      leftAt: null,
      isActive: true,
    },
    {
      showId: "show_demo_2023",
      title: "Into the Woods",
      year: 2023,
      joinedAt: "2023-02-10T18:00:00.000Z",
      leftAt: "2023-09-24T21:00:00.000Z",
      isActive: false,
    },
  ],
} as const;

export type DevDashboardOverviewFixture = typeof DEV_DASHBOARD_OVERVIEW_FIXTURE;
