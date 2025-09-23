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
