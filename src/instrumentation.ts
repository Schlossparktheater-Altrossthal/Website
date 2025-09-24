import type { AnalyticsRequestArea } from "@prisma/client";

import { ingestHttpRequest } from "@/lib/analytics/ingest-http";

const requestMeta = new WeakMap<Request, PendingRequest>();

const IGNORED_PREFIXES = ["/_next", "/_proxy", "/favicon", "/assets", "/fonts", "/icons"];
const IGNORED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico", ".css", ".js", ".map"];

const isNodeRuntime = () => typeof process !== "undefined" && process.env.NEXT_RUNTIME !== "edge";

type PendingRequest = {
  startedAt: number;
  route: string;
  area: AnalyticsRequestArea;
  payloadBytes: number;
  method: string;
};

type RequestEvent = {
  request: Request;
};

type ResponseEvent = {
  request: Request;
  response: Response;
};

export function register() {
  // Intentionally empty – required so Next.js loads this instrumentation module.
}

function shouldTrackPath(pathname: string, method: string) {
  if (method === "OPTIONS") {
    return false;
  }
  if (pathname === "") {
    return false;
  }
  for (const prefix of IGNORED_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      return false;
    }
  }
  for (const extension of IGNORED_EXTENSIONS) {
    if (pathname.endsWith(extension)) {
      return false;
    }
  }
  return true;
}

function deriveArea(pathname: string): AnalyticsRequestArea {
  if (pathname.startsWith("/api")) {
    return "api";
  }
  if (pathname.startsWith("/mitglieder") || pathname.startsWith("/members")) {
    return "members";
  }
  return "public";
}

function parseContentLength(request: Request) {
  const header = request.headers.get("content-length");
  if (!header) {
    return 0;
  }
  const value = Number.parseInt(header, 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function normalizeRoute(pathname: string) {
  if (pathname.length === 0) {
    return "/";
  }
  if (pathname !== "/" && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function trackRequest(request: Request) {
  let url: URL;
  try {
    url = new URL(request.url);
  } catch (error) {
    console.error("[analytics] Failed to parse request URL", error);
    return;
  }

  const pathname = url.pathname || "/";
  const method = request.method?.toUpperCase?.() ?? "GET";
  if (!shouldTrackPath(pathname, method)) {
    return;
  }

  const route = normalizeRoute(pathname);
  const area = deriveArea(route);
  const payloadBytes = parseContentLength(request);

  requestMeta.set(request, {
    startedAt: Date.now(),
    route,
    area,
    payloadBytes,
    method,
  });
}

function finalizeRequest(request: Request, response: Response) {
  const metadata = requestMeta.get(request);
  if (!metadata) {
    return;
  }
  requestMeta.delete(request);

  const finishedAt = Date.now();
  const statusCode = typeof response.status === "number" ? response.status : 0;
  const durationMs = Math.max(0, finishedAt - metadata.startedAt);

  void ingestHttpRequest({
    timestamp: new Date(metadata.startedAt),
    route: metadata.route,
    area: metadata.area,
    statusCode,
    durationMs,
    payloadBytes: metadata.payloadBytes,
    method: metadata.method,
  }).catch((error) => {
    console.error("[analytics] Failed to record HTTP request", error);
  });
}

export function onRequest(event: RequestEvent) {
  if (!isNodeRuntime()) {
    return;
  }
  trackRequest(event.request);
}

export function onResponse(event: ResponseEvent) {
  if (!isNodeRuntime()) {
    return;
  }
  if (!event?.response) {
    return;
  }
  finalizeRequest(event.request, event.response);
}
