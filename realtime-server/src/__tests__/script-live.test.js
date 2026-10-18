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
