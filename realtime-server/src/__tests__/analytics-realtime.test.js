import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { setTimeout as wait } from 'node:timers/promises';
import { test } from 'node:test';

import { createAnalyticsManager } from '../analytics.js';

test('analytics manager handles bursts of external notifications', async () => {
  const staticData = {
    resourceUsage: [
      {
        id: 'cpu',
        label: 'CPU',
        usagePercent: 25,
        changePercent: 0,
        capacity: '2 cores',
      },
    ],
    deviceBreakdown: [{ device: 'Desktop', sessions: 10, avgPageLoadMs: 500, share: 0.5 }],
    publicPages: [{ path: '/home', title: 'Home', loadTimeMs: 1000 }],
    memberPages: [{ path: '/members', title: 'Members', loadTimeMs: 900 }],
  };

  const emitter = new EventEmitter();
  let refreshCalls = 0;

  const manager = createAnalyticsManager({
    logger: { warn: () => {}, error: () => {} },
    intervalMs: 10_000,
    maxAgeMs: 20_000,
    loadStaticData: () => JSON.parse(JSON.stringify(staticData)),
    collectResourceUsage: async () => {
      refreshCalls += 1;
      await wait(5);
      return staticData.resourceUsage;
    },
    subscribeToExternalUpdates: (handler) => {
      emitter.on('trigger', handler);
      return {
        async close() {
          emitter.off('trigger', handler);
        },
      };
    },
  });

  const emittedEvents = [];
  const io = {
    emit(event, payload) {
      emittedEvents.push({ event, payload });
    },
  };

  manager.start(io);
  await wait(20);

  const bursts = 50;
  for (let index = 0; index < bursts; index += 1) {
    emitter.emit('trigger', { job: 'test', index });
  }

  await wait(100);
  manager.stop();

  assert.ok(emittedEvents.length >= bursts);
  assert.ok(emittedEvents.length <= bursts + 2);
  assert.ok(refreshCalls <= bursts + 2);
  assert.equal(manager.state.refreshPromise, null);

  const lastEvent = emittedEvents.at(-1);
  assert.ok(lastEvent);
  assert.equal(lastEvent.event, 'server_analytics_update');
  assert.equal(lastEvent.payload.type, 'server_analytics_update');
  assert.equal(lastEvent.payload.analytics.metadata.source, 'fallback');
  assert.equal(lastEvent.payload.analytics.metadata.attempts, 1);
  assert.ok(Array.isArray(lastEvent.payload.analytics.metadata.fallbackReasons));
  assert.ok(
    lastEvent.payload.analytics.metadata.fallbackReasons.includes(
      'DATABASE_URL ist nicht gesetzt – verwende statische Kennzahlen',
    ),
  );
  assert.equal(typeof lastEvent.payload.analytics.summary.requestsLast24h, 'number');
});
