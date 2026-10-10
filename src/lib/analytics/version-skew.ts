/**
 * Nach einem Release kennt der Server die Chunks und Server Actions offener alter Tabs nicht mehr
 * (ChunkLoadError, "Server Action … was not found"). Dann einmal neu laden statt zu hängen.
 */
const SKEW_PATTERN =
  /ChunkLoadError|Failed to load chunk|Server Action .* was not found on the server/;
const RELOAD_KEY = "version-skew-reload";
const RELOAD_GUARD_MS = 60_000;

export function isVersionSkewError(message: string): boolean {
  return SKEW_PATTERN.test(message);
}

/** Lädt höchstens einmal pro Minute neu, damit ein echter Fehler keine Schleife auslöst. */
export function reloadOnVersionSkew(message: string): boolean {
  if (!isVersionSkewError(message)) return false;
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < RELOAD_GUARD_MS) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
