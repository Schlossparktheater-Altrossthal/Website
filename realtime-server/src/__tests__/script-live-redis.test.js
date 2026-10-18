/**
 * Mitlesen über mehrere Pods (docs/Plan/skript-mitlesen-plan.md, E8): zwei Realtime-Server an
 * einem Redis. Läuft nur mit TEST_REDIS_URL (eigene Variable: andere Testdateien laufen parallel
 * und würden sonst über denselben Redis mithören), z. B.
 *   docker run -d --rm --name mb-redis-test -p 127.0.0.1:6390:6379 redis:7-alpine
 *   TEST_REDIS_URL=redis://127.0.0.1:6390 node --test
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { io as createClient } from "socket.io-client";

import { createRealtimeServer } from "../createRealtimeServer.js";

const SECRET = "test-secret";
const REDIS_URL = process.env.TEST_REDIS_URL;
// createRealtimeServer liest REDIS_URL; gilt nur in diesem Testprozess.
if (REDIS_URL) process.env.REDIS_URL = REDIS_URL;

function token(userId) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 60_000;
  const signature = createHmac("sha256", SECRET)
    .update(`${userId}:${issuedAt}:${expiresAt}`)
    .digest("hex");
  return `${issuedAt}.${expiresAt}.${signature}`;
}

async function startServer() {
  let ready;
  const adapter = new Promise((resolve) => (ready = resolve));
  const server = createRealtimeServer({
    port: 0,
    handshakeSecret: SECRET,
    logger: {
      log: (message) => String(message).includes("Using Redis adapter") && ready(),
      info: (message) => String(message).includes("Using Redis adapter") && ready(),
      warn() {},
      error() {},
    },
  });
  await server.listen(0);
  await adapter;
  return server;
}

async function connect(server, userId, userName) {
  const { port } = server.httpServer.address();
  const client = createClient(`http://localhost:${port}`, {
    path: server.config.socketPath,
    transports: ["websocket"],
    auth: { userId, userName, token: token(userId) },
  });
  await new Promise((resolve, reject) => {
    client.once("connect", resolve);
    client.once("connect_error", reject);
  });
  return client;
}

function next(client, event, match = () => true, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`kein ${event}`)), timeout);
    const handler = (payload) => {
      if (!match(payload)) return;
      clearTimeout(timer);
      client.off(event, handler);
      resolve(payload);
    };
    client.on(event, handler);
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test(
  "Mitlesen über zwei Pods: Liste, Positionen, eine Schätzung, Übernahme bei Ausfall",
  { skip: !REDIS_URL && "TEST_REDIS_URL fehlt" },
  async () => {
    const podA = await startServer();
    const podB = await startServer();
    const versionId = `redis-${Date.now()}`;
    const lead = await connect(podA, "u-lead", "Souffleuse");
    const reader = await connect(podB, "u-read", "Darsteller");
    const late = await connect(podB, "u-late", "Nachzügler");
    let podAOpen = true;
    try {
      lead.emit("script_live_join", { versionId, followable: true });
      const roster = next(reader, "script_live_roster", (r) => r.readers === 3);
      reader.emit("script_live_join", { versionId, followable: false });
      late.emit("script_live_join", { versionId, followable: false });
      // Teilnehmerliste über beide Pods.
      const both = await roster;
      assert.deepEqual(
        both.leaders.map((l) => l.userId),
        ["u-lead"],
      );

      // Position der Führung (Pod A) kommt bei Folgenden auf Pod B an.
      const position = next(reader, "script_live_position");
      lead.emit("script_live_position", { index: 50, fraction: 0, pos: 5000 });
      assert.equal((await position).index, 50);
      reader.emit("script_live_position", { index: 51, fraction: 0, pos: 5100 });
      late.emit("script_live_position", { index: 10, fraction: 0, pos: 1000 });

      // Status mit Abgehängten erreicht die Führung, obwohl sie auf dem anderen Pod sitzt.
      const status = await next(lead, "script_live_status", (s) => s.behind.length === 1);
      assert.equal(status.behind[0].userId, "u-late");

      // Genau ein Pod rechnet: ~2 Schätzungen pro Sekunde, nicht 4.
      let count = 0;
      const onEstimate = (event) => event.versionId === versionId && (count += 1);
      reader.on("script_live_estimate", onEstimate);
      await wait(3000);
      reader.off("script_live_estimate", onEstimate);
      assert.ok(count >= 4 && count <= 8, `Schätzungen in 3 s: ${count}`);

      // Pod A fällt aus: Pod B übernimmt die Sperre und rechnet weiter.
      lead.disconnect();
      await podA.close();
      podAOpen = false;
      reader.emit("script_live_position", { index: 52, fraction: 0, pos: 5200 });
      late.emit("script_live_position", { index: 52, fraction: 0, pos: 5210 });
      const resumed = await next(
        late,
        "script_live_estimate",
        (e) => e.versionId === versionId,
        8000,
      );
      assert.ok(resumed.pos > 900, `pos ${resumed.pos}`);
    } finally {
      for (const client of [lead, reader, late]) client.disconnect();
      if (podAOpen) await podA.close();
      await podB.close();
    }
  },
);
