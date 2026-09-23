/** Öffentliche Basis-URL des Mitgliederbereichs (für Links in Mails), ohne abschließenden Slash. */
export function getAppBaseUrl(): string {
  return (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}
