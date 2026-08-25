export type InterestSuggestion = {
  name: string;
  usage: number;
};

function toSuggestion(entry: unknown): InterestSuggestion | null {
  if (typeof entry === "string") {
    const name = entry.trim();
    if (!name) {
      return null;
    }
    return { name, usage: 0 } satisfies InterestSuggestion;
  }

  if (!entry || typeof entry !== "object") {
    return null;
  }

  const record = entry as { name?: unknown; usage?: unknown };
  const name = typeof record.name === "string" ? record.name.trim() : "";
  if (!name) {
    return null;
  }

  const usage =
    typeof record.usage === "number" && Number.isFinite(record.usage) && record.usage >= 0
      ? Math.floor(record.usage)
      : 0;

  return { name, usage } satisfies InterestSuggestion;
}

export function parseInterestSuggestions(payload: unknown): InterestSuggestion[] {
  const list: unknown[] = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === "object" &&
        Array.isArray((payload as { interests?: unknown }).interests)
      ? ((payload as { interests: unknown[] }).interests ?? [])
      : [];

  const seen = new Set<string>();
  const suggestions: InterestSuggestion[] = [];

  for (const entry of list) {
    const suggestion = toSuggestion(entry);
    if (!suggestion) {
      continue;
    }
    const normalized = suggestion.name.trim();
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    suggestions.push({ name: normalized, usage: suggestion.usage });
  }

  return suggestions;
}
