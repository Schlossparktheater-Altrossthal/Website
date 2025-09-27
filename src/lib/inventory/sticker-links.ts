export const INVENTORY_ITEM_ROUTE_PREFIX = "/mitglieder/inventar" as const;

function normalizeCode(code: string): string {
  return code.trim();
}

function ensureLeadingSlash(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

export function buildInventoryItemPath(code: string): string {
  const normalized = normalizeCode(code);
  const encoded = encodeURIComponent(normalized);
  return `${INVENTORY_ITEM_ROUTE_PREFIX}/${encoded}`;
}

function resolveBaseOrigin(explicitOrigin?: string | null): string | null {
  if (explicitOrigin && explicitOrigin.trim().length > 0) {
    return explicitOrigin.trim();
  }

  const envBase = process.env.NEXT_PUBLIC_BASE_URL;
  if (envBase && envBase.trim().length > 0) {
    return envBase.trim();
  }

  return null;
}

export function buildInventoryItemUrl(code: string, origin?: string | null): string {
  const path = buildInventoryItemPath(code);
  const resolvedOrigin = resolveBaseOrigin(origin);

  if (!resolvedOrigin) {
    return path;
  }

  try {
    return new URL(path, resolvedOrigin).toString();
  } catch {
    const sanitizedOrigin = resolvedOrigin.replace(/\/+$/, "");
    const normalizedPath = ensureLeadingSlash(path);
    return `${sanitizedOrigin}${normalizedPath}`;
  }
}

function extractCodeFromPath(pathname: string): string | null {
  if (!pathname) {
    return null;
  }

  const normalized = pathname.replace(/\/+$/, "");
  const segments = normalized.split("/").filter(Boolean);

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const next = segments[index + 1];
    if (segment === "mitglieder" && next === "inventar") {
      const codeSegment = segments[index + 2];
      if (codeSegment) {
        try {
          return decodeURIComponent(codeSegment);
        } catch {
          return codeSegment;
        }
      }
    }
    if (segment === "inventar") {
      const codeSegment = segments[index + 1];
      if (codeSegment) {
        try {
          return decodeURIComponent(codeSegment);
        } catch {
          return codeSegment;
        }
      }
    }
  }

  return null;
}

export interface InventoryStickerDetails {
  code: string;
  path: string;
}

export function parseInventoryStickerInput(input: string): InventoryStickerDetails {
  const trimmed = input.trim();

  if (!trimmed) {
    return { code: "", path: buildInventoryItemPath("") };
  }

  const candidates: Array<() => string | null> = [
    () => {
      try {
        const url = new URL(trimmed);
        return (
          extractCodeFromPath(url.pathname) ||
          url.searchParams.get("code") ||
          url.searchParams.get("sku")
        );
      } catch {
        return null;
      }
    },
    () => {
      if (trimmed.startsWith("/")) {
        return extractCodeFromPath(trimmed);
      }
      return null;
    },
  ];

  for (const getCandidate of candidates) {
    const candidate = getCandidate();
    if (candidate && candidate.trim().length > 0) {
      const normalized = normalizeCode(candidate);
      return { code: normalized, path: buildInventoryItemPath(normalized) };
    }
  }

  const normalized = normalizeCode(trimmed);
  return { code: normalized, path: buildInventoryItemPath(normalized) };
}

export function formatInventoryLinkLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    const host = url.host;
    const pathname = url.pathname.replace(/\/+$/, "");
    return pathname ? `${host}${pathname}` : host;
  } catch {
    if (trimmed.startsWith("http://")) {
      return trimmed.slice("http://".length);
    }
    if (trimmed.startsWith("https://")) {
      return trimmed.slice("https://".length);
    }
    return trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
  }
}
