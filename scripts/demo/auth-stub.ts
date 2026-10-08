// Ersatz für src/auth.ts im Demo-Seed-Bundle (scripts/demo/bundle.mjs): der Seed läuft ohne
// Anfrage und Sitzung, next-auth lässt sich außerhalb von Next nicht laden.
export async function auth() {
  return null;
}
