import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { io as createClient } from "socket.io-client";

import { createRealtimeServer } from "../createRealtimeServer.js";

const SECRET = "test-secret";

function token(userId) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 60_000;
  const signature = createHmac("sha256", SECRET)
    .update(`${userId}:${issuedAt}:${expiresAt}`)
    .digest("hex");
  return `${issuedAt}.${expiresAt}.${signature}`;
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

/** Wartet auf das erste Ereignis, das `match` erfüllt. */
function next(client, event, match = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`kein ${event}`)), 3000);
    const handler = (payload) => {
      if (!match(payload)) return;
      clearTimeout(timer);
      client.off(event, handler);
      resolve(payload);
    };
    client.on(event, handler);
  });
}

test("Skript-Raum: Teilnehmer, Führende und Positionen", async () => {
  const server = createRealtimeServer({
    port: 0,
    handshakeSecret: SECRET,
    logger: { log() {}, warn() {}, error() {} },
  });
  await server.listen(0);
  const lead = await connect(server, "u-lead", "Souffleuse");
  const reader = await connect(server, "u-read", "Darsteller");
  try {
    let roster = next(lead, "script_live_roster", (r) => r.leaders.length === 1);
    lead.emit("script_live_join", { versionId: "v1", followable: true });
    await roster;

    roster = next(reader, "script_live_roster", (r) => r.readers === 2);
    reader.emit("script_live_join", { versionId: "v1", followable: false });
    const both = await roster;
    assert.deepEqual(
      both.leaders.map((l) => [l.userId, l.name]),
      [["u-lead", "Souffleuse"]],
    );

    // Positionen der Führenden kommen bei den anderen an, ungültige werden verworfen.
    const position = next(reader, "script_live_position");
    lead.emit("script_live_position", { index: -1, fraction: 0 });
    lead.emit("script_live_position", { index: 12, fraction: 1.7 });
    const got = await position;
    assert.equal(got.userId, "u-lead");
    assert.equal(got.index, 12);
    assert.equal(got.fraction, 1);

    // Wer nicht folgbar ist, sendet nichts an andere.
    let leaked = false;
    lead.on("script_live_position", () => (leaked = true));
    reader.emit("script_live_position", { index: 3, fraction: 0.5 });
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.equal(leaked, false);

    // Neue Teilnehmende sehen die letzte Stelle der Führenden sofort.
    const late = await connect(server, "u-late", "Technik");
    roster = next(late, "script_live_roster", (r) => r.readers === 3);
    late.emit("script_live_join", { versionId: "v1", followable: false });
    const lateRoster = await roster;
    assert.equal(lateRoster.leaders[0].index, 12);
    late.disconnect();

    // Führung abgeben und Verlassen aktualisieren die Liste.
    roster = next(reader, "script_live_roster", (r) => r.leaders.length === 0 && r.readers === 2);
    lead.emit("script_live_update", { followable: false });
    await roster;
    roster = next(reader, "script_live_roster", (r) => r.readers === 1);
    lead.emit("script_live_leave");
    await roster;
  } finally {
    lead.disconnect();
    reader.disconnect();
    await server.close();
  }
});

test("Skript-Raum: zwei Geräte einer Person zählen einmal, Positionen tragen das Gerät", async () => {
  const server = createRealtimeServer({
    port: 0,
    handshakeSecret: SECRET,
    logger: { log() {}, warn() {}, error() {} },
  });
  await server.listen(0);
  const phone = await connect(server, "u-lead", "Souffleuse");
  const tablet = await connect(server, "u-lead", "Souffleuse");
  const reader = await connect(server, "u-read", "Darsteller");
  try {
    phone.emit("script_live_join", { versionId: "v2", followable: true });
    tablet.emit("script_live_join", { versionId: "v2", followable: true });
    const roster = next(reader, "script_live_roster", (r) => r.readers === 2);
    reader.emit("script_live_join", { versionId: "v2", followable: false });
    const got = await roster;
    assert.equal(got.leaders.length, 1);

    const fromTablet = next(reader, "script_live_position");
    tablet.emit("script_live_position", { index: 5, fraction: 0 });
    assert.equal((await fromTablet).deviceId, tablet.id);
  } finally {
    phone.disconnect();
    tablet.disconnect();
    reader.disconnect();
    await server.close();
  }
});

test("Skript-Raum: Live-Stelle aus allen Mitlesenden, Folgende zählen nicht", async () => {
  const server = createRealtimeServer({
    port: 0,
    handshakeSecret: SECRET,
    logger: { log() {}, warn() {}, error() {} },
  });
  await server.listen(0);
  const a = await connect(server, "u-a", "A");
  const b = await connect(server, "u-b", "B");
  const echo = await connect(server, "u-c", "C");
  try {
    for (const client of [a, b, echo]) {
      client.emit("script_live_join", { versionId: "v3", followable: false });
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    a.emit("script_live_position", { index: 10, fraction: 0, pos: 1000 });
    b.emit("script_live_position", { index: 11, fraction: 0, pos: 1100 });
    // Folgt selbst automatisch: würde sonst die Schätzung auf sich ziehen.
    echo.emit("script_live_position", { index: 90, fraction: 0, pos: 9000, echo: true });
    const live = await next(echo, "script_live_estimate", (e) => e.active === 2);
    assert.equal(live.versionId, "v3");
    assert.ok(live.pos >= 1000 && live.pos <= 1100, `pos ${live.pos}`);
    assert.equal(live.confident, true);
  } finally {
    a.disconnect();
    b.disconnect();
    echo.disconnect();
    await server.close();
  }
});

test("Skript-Raum: Führende sehen, wer abgehängt ist (E7)", async () => {
  const server = createRealtimeServer({
    port: 0,
    handshakeSecret: SECRET,
    logger: { log() {}, warn() {}, error() {} },
  });
  await server.listen(0);
  const lead = await connect(server, "u-lead", "Souffleuse");
  const a = await connect(server, "u-a", "A");
  const late = await connect(server, "u-late", "Nachzügler");
  const echo = await connect(server, "u-echo", "Folgt");
  try {
    lead.emit("script_live_join", { versionId: "v4", followable: true });
    for (const client of [a, late, echo]) {
      client.emit("script_live_join", { versionId: "v4", followable: false });
    }
    // Nur Führende bekommen den Status mit Namen.
    let leaked = false;
    a.on("script_live_status", () => (leaked = true));
    await new Promise((resolve) => setTimeout(resolve, 100));
    lead.emit("script_live_position", { index: 50, fraction: 0, pos: 5000, cps: 9 });
    a.emit("script_live_position", { index: 51, fraction: 0, pos: 5100 });
    late.emit("script_live_position", { index: 10, fraction: 0, pos: 1000 });
    echo.emit("script_live_position", { index: 50, fraction: 0, pos: 5000, echo: true });
    const status = await next(lead, "script_live_status", (s) => s.behind.length === 1);
    assert.equal(status.behind[0].name, "Nachzügler");
    assert.equal(status.following, 1);
    assert.equal(status.reading, 2);
    assert.ok(status.livePos >= 5000 && status.livePos <= 5100, `pos ${status.livePos}`);
    const live = await next(a, "script_live_estimate");
    // Starttempo aus der Szenenzeit (9 Zeichen/s) statt 14.
    assert.ok(live.rate > 6 && live.rate < 12, `rate ${live.rate}`);
    assert.equal(leaked, false);
  } finally {
    for (const client of [lead, a, late, echo]) client.disconnect();
    await server.close();
  }
});
