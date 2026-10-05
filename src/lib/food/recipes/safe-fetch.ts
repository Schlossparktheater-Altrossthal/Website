import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Abruf fremder Seiten im Auftrag von Mitgliedern (Rezept-Import) ohne Zugriff auf interne
 * Adressen: Jede Weiterleitung wird einzeln geprüft, Ziele in privaten, Loopback-, Link-Local-
 * und Cluster-Netzen werden abgelehnt.
 */

const MAX_REDIRECTS = 3;

function ipv4Blocked(address: string): boolean {
  const [a, b] = address.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

export function isBlockedAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return ipv4Blocked(address);
  if (version === 6) {
    const lower = address.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return ipv4Blocked(mapped[1]);
    return (
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe80") ||
      lower.startsWith("ff")
    );
  }
  return true;
}

async function assertPublicHost(url: URL): Promise<void> {
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new Error("Nur http(s)-Adressen.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (/^localhost$|\.local$|\.internal$|\.svc$|\.cluster\.local$/i.test(host)) {
    throw new Error("Adresse nicht erlaubt.");
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new Error("Adresse nicht erlaubt.");
  }
}

async function safeFetch(
  input: string,
  options: { accept: string; timeoutMs: number },
): Promise<{ url: string; response: Response }> {
  let url = new URL(input);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublicHost(url);
    const response = await fetch(url, {
      headers: {
        Accept: options.accept,
        "User-Agent": "Mozilla/5.0 (compatible; Mitgliederbereich-Rezeptimport)",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(options.timeoutMs),
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) throw new Error(`Seite antwortet mit ${response.status}.`);
    return { url: url.toString(), response };
  }
  throw new Error("Zu viele Weiterleitungen.");
}

export async function safeFetchText(
  input: string,
  options: { accept: string; maxBytes: number; timeoutMs: number },
): Promise<{ url: string; text: string }> {
  const { url, response } = await safeFetch(input, options);
  const text = await response.text();
  return { url, text: text.slice(0, options.maxBytes) };
}

/** Lädt eine Datei (z. B. ein Rezeptbild) und bricht ab, sobald sie größer als `maxBytes` wird. */
export async function safeFetchBytes(
  input: string,
  options: { accept: string; maxBytes: number; timeoutMs: number },
): Promise<{ url: string; data: Uint8Array; contentType: string | null }> {
  const { url, response } = await safeFetch(input, options);
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > options.maxBytes) throw new Error("Datei zu groß.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Leere Antwort.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > options.maxBytes) {
      await reader.cancel();
      throw new Error("Datei zu groß.");
    }
    chunks.push(value);
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { url, data, contentType: response.headers.get("content-type") };
}
