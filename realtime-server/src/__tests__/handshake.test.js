import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { parseHandshakeToken, verifyHandshake } from '../handshake.js';

test('verifyHandshake accepts valid tokens', () => {
  const secret = 'super-secret';
  const userId = 'user-123';
  const issuedAt = 1_000_000;
  const expiresAt = issuedAt + 10_000;
  const base = `${userId}:${issuedAt}:${expiresAt}`;
  const signature = createHmac('sha256', secret).update(base).digest('hex');
  const token = `${issuedAt}.${expiresAt}.${signature}`;

  const result = verifyHandshake({ userId, token, secret, now: () => issuedAt + 1_000 });

  assert.equal(result.ok, true);
  assert.equal(result.issuedAt, issuedAt);
  assert.equal(result.expiresAt, expiresAt);
});

test('verifyHandshake rejects expired tokens', () => {
  const secret = 'another-secret';
  const userId = 'user-456';
  const issuedAt = 2_000_000;
  const expiresAt = issuedAt + 5_000;
  const base = `${userId}:${issuedAt}:${expiresAt}`;
  const signature = createHmac('sha256', secret).update(base).digest('hex');
  const token = `${issuedAt}.${expiresAt}.${signature}`;

  const result = verifyHandshake({ userId, token, secret, now: () => expiresAt + 1 });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'Token expired');
});

test('parseHandshakeToken returns null for malformed tokens', () => {
  assert.equal(parseHandshakeToken('not-a-token'), null);
  assert.equal(parseHandshakeToken('1.two.three.four'), null);
  assert.equal(parseHandshakeToken('1.two'), null);
});
