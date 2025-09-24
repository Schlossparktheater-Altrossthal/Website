import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAnalyticsManager } from '../analytics.js';

test('analytics manager refreshes snapshots with fallback data', async () => {
  const staticData = {
    resourceUsage: [],
    deviceBreakdown: [{ label: 'Mobile', value: 50 }],
    publicPages: [{ path: '/home', ttfb: 120 }],
    memberPages: [{ path: '/members', ttfb: 140 }],
  };

  let currentTime = 1_000;
  let resourceCalls = 0;

  const toISO = (value) => new Date(value).toISOString();

  const manager = createAnalyticsManager({
    logger: { warn: () => {}, error: () => {} },
    intervalMs: 2_500,
    maxAgeMs: 5_000,
    toISO,
    now: () => currentTime,
    loadStaticData: () => JSON.parse(JSON.stringify(staticData)),
    collectResourceUsage: async ({ previousResourceUsage }) => {
      assert.ok(previousResourceUsage instanceof Map);
      resourceCalls += 1;
      return [
        {
          id: 'app-cpu',
          label: 'CPU',
          usagePercent: 37.5,
          capacity: '2 cores',
        },
      ];
    },
    importAnalyticsModule: async () => {
      const error = new Error('not found');
      error.code = 'ERR_MODULE_NOT_FOUND';
      throw error;
    },
    getDatabaseUrl: () => null,
  });

  const firstSnapshot = await manager.refresh();
  assert.equal(firstSnapshot.generatedAt, toISO(1_000));
  assert.deepEqual(firstSnapshot.resourceUsage, [
    {
      id: 'app-cpu',
      label: 'CPU',
      usagePercent: 37.5,
      capacity: '2 cores',
    },
  ]);
  assert.deepEqual(firstSnapshot.deviceBreakdown, [{ label: 'Mobile', value: 50 }]);
  assert.equal(resourceCalls, 1);

  const cachedSnapshot = await manager.getSnapshot();
  assert.strictEqual(cachedSnapshot, firstSnapshot);
  assert.equal(resourceCalls, 1);

  currentTime = 7_000;
  const refreshedSnapshot = await manager.getSnapshot();
  assert.equal(refreshedSnapshot.generatedAt, toISO(7_000));
  assert.equal(resourceCalls, 2);

  firstSnapshot.deviceBreakdown[0].value = 0;
  currentTime = 12_000;
  const nextSnapshot = await manager.refresh();
  assert.equal(nextSnapshot.generatedAt, toISO(12_000));
  assert.equal(nextSnapshot.deviceBreakdown[0].value, 50);
  assert.equal(resourceCalls, 3);
});

test('analytics manager merges database overrides when module is available', async () => {
  const staticData = {
    resourceUsage: [
      {
        id: 'app-cpu',
        label: 'CPU',
        usagePercent: 25,
        changePercent: 0,
        capacity: '2 cores',
      },
    ],
    deviceBreakdown: [
      { device: 'Desktop', sessions: 100, avgPageLoadMs: 600, share: 0.5 },
      { device: 'Mobile', sessions: 80, avgPageLoadMs: 650, share: 0.5 },
    ],
    publicPages: [
      { path: '/home', title: 'Home', loadTimeMs: 1000, lcpMs: 1200 },
      { path: '/about', title: 'About', loadTimeMs: 900, lcpMs: 1000 },
    ],
    memberPages: [
      { path: '/members', title: 'Members', loadTimeMs: 950, lcpMs: 1050 },
    ],
  };

  const analyticsModule = await import('../../src/lib/server-analytics-data.js');

  let currentTime = 5000;
  const toISO = (value) => new Date(value).toISOString();

  const manager = createAnalyticsManager({
    logger: { warn: () => {}, error: () => {} },
    intervalMs: 2_000,
    maxAgeMs: 4_000,
    toISO,
    now: () => currentTime,
    loadStaticData: () => JSON.parse(JSON.stringify(staticData)),
    collectResourceUsage: async () => staticData.resourceUsage,
    importAnalyticsModule: async () => ({
      mergeDeviceBreakdown: analyticsModule.mergeDeviceBreakdown,
      applyPagePerformanceMetrics: analyticsModule.applyPagePerformanceMetrics,
      loadDeviceBreakdownFromDatabase: async () => [
        { device: 'Desktop', sessions: 150, avgPageLoadMs: 420, share: 0.6 },
        { device: 'Mobile', sessions: 120, avgPageLoadMs: 520, share: 0.4 },
      ],
      loadPagePerformanceMetrics: async () => [
        { path: '/home', avgPageLoadMs: 890, scope: 'public' },
        { path: '/members', avgPageLoadMs: 640, scope: 'members' },
      ],
    }),
    getDatabaseUrl: () => 'postgres://example',
  });

  const snapshot = await manager.refresh();

  assert.equal(snapshot.deviceBreakdown.length, 2);
  assert.equal(snapshot.deviceBreakdown[0].device, 'Desktop');
  assert.equal(snapshot.deviceBreakdown[0].sessions, 150);
  assert.equal(snapshot.deviceBreakdown[0].avgPageLoadMs, 420);
  assert.equal(snapshot.deviceBreakdown[1].device, 'Mobile');
  assert.equal(snapshot.deviceBreakdown[1].sessions, 120);
  assert.equal(snapshot.deviceBreakdown[1].avgPageLoadMs, 520);

  const homePage = snapshot.publicPages.find((entry) => entry.path === '/home');
  assert.ok(homePage);
  assert.equal(homePage.loadTimeMs, 890);

  const memberPage = snapshot.memberPages.find((entry) => entry.path === '/members');
  assert.ok(memberPage);
  assert.equal(memberPage.loadTimeMs, 640);
});
