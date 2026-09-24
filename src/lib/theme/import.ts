import {
  ThemeImportError,
  parseThemeInput,
  parseThemeRegistryItem,
  toTweakcnRegistryUrl,
  type TweakcnTheme,
} from "@/lib/theme/tweakcn";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 200_000;

export type ResolvedThemeImport = {
  theme: TweakcnTheme;
  /** Name aus dem Registry-Item, falls vorhanden. */
  suggestedName: string | null;
};

function readRegistryName(json: unknown): string | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return null;
  }
  const name = (json as Record<string, unknown>).name;
  return typeof name === "string" && name.trim() ? name.trim().slice(0, 120) : null;
}

async function fetchRegistryItem(url: string): Promise<ResolvedThemeImport> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    console.error("tweakcn theme fetch failed", error);
    throw new ThemeImportError("tweakcn.com ist nicht erreichbar.");
  }
  if (!response.ok) {
    throw new ThemeImportError(
      response.status === 404
        ? "Theme auf tweakcn.com nicht gefunden. Ist es veröffentlicht?"
        : `tweakcn.com antwortet mit Status ${response.status}.`,
    );
  }
  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES) {
    throw new ThemeImportError("Die Antwort von tweakcn.com ist zu groß.");
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ThemeImportError("tweakcn.com hat kein gültiges JSON geliefert.");
  }
  return { theme: parseThemeRegistryItem(json), suggestedName: readRegistryName(json) };
}

/**
 * Löst eine Import-Eingabe auf: tweakcn-Link (wird serverseitig geladen), Registry-JSON oder CSS.
 * Andere URLs werden bewusst nicht abgerufen.
 */
export async function resolveThemeImport(source: string): Promise<ResolvedThemeImport> {
  const trimmed = source.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    const registryUrl = toTweakcnRegistryUrl(trimmed);
    if (!registryUrl) {
      throw new ThemeImportError(
        "Nur Links von tweakcn.com werden unterstützt (z. B. https://tweakcn.com/r/themes/<name>.json).",
      );
    }
    return fetchRegistryItem(registryUrl);
  }

  let suggestedName: string | null = null;
  if (trimmed.startsWith("{")) {
    try {
      suggestedName = readRegistryName(JSON.parse(trimmed));
    } catch {
      suggestedName = null;
    }
  }
  return { theme: parseThemeInput(trimmed), suggestedName };
}
