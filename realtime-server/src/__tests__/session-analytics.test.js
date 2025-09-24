import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { setTimeout as wait } from 'node:timers/promises';
import { test } from 'node:test';
import { io as createClient } from 'socket.io-client';

import { createRealtimeServer } from '../createRealtimeServer.js';

function createHandshakeToken(userId, secret, ttlMs = 60_000) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + ttlMs;
  const signature = createHmac('sha256', secret).update(`${userId}:${issuedAt}:${expiresAt}`).digest('hex');
  return `${issuedAt}.${expiresAt}.${signature}`;
}

test('records analytics events for socket lifecycle', async () => {
  const recordedEvents = [];
  const analyticsRecorder = {
    async record(eventType) {
      recordedEvents.push(eventType);
    },
    async flush() {},
  };

  const server = createRealtimeServer({
    port: 0,
    handshakeSecret: 'test-secret',
    analyticsRecorder,
  });

  await server.listen(0);
  const address = server.httpServer.address();
  assert.ok(address && typeof address.port === 'number');

  const token = createHandshakeToken('user-1', 'test-secret');

  const client = createClient(`http://localhost:${address.port}`, {
    path: server.config.socketPath,
    transports: ['websocket'],
    auth: {
      userId: 'user-1',
      userName: 'Test User',
      token,
    },
  });

  await new Promise((resolve, reject) => {
    client.once('connect', resolve);
    client.once('connect_error', reject);
  });

  await new Promise((resolve) => {
    client.once('pong', resolve);
    client.emit('ping');
  });

  client.emit('join_room', 'global');
  client.emit('leave_room', 'global');

  await wait(50);

  await new Promise((resolve) => {
    client.once('disconnect', resolve);
    client.close();
  });

  await server.close();

  assert.ok(recordedEvents.includes('socket_connected'));
  assert.ok(recordedEvents.includes('user_authenticated'));
  assert.ok(recordedEvents.includes('ping'));
  assert.ok(recordedEvents.includes('join_room'));
  assert.ok(recordedEvents.includes('leave_room'));
  assert.ok(recordedEvents.includes('socket_disconnected'));
});
