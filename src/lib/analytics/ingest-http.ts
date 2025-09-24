import type { AnalyticsRequestArea } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const MAX_BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 1_500;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 200;

type IngestEvent = {
  timestamp: Date | number;
  route: string;
  area: AnalyticsRequestArea;
  statusCode: number;
  durationMs: number;
  payloadBytes: number;
  method?: string;
};

type NormalizedEvent = {
  timestamp: Date;
  route: string;
  area: AnalyticsRequestArea;
  statusCode: number;
  durationMs: number;
  payloadBytes: number;
  method: string;
};

const pendingEvents: NormalizedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let activeFlush: Promise<void> | null = null;

function hasDatabaseConnection() {
  return typeof process !== "undefined" && Boolean(process.env.DATABASE_URL);
}

function parseTimestamp(value: Date | number) {
  if (value instanceof Date) {
    if (Number.isFinite(value.getTime())) {
      return value;
    }
    return new Date();
  }
  const timestamp = Number(value);
  if (Number.isFinite(timestamp)) {
    const date = new Date(timestamp);
    if (Number.isFinite(date.getTime())) {
      return date;
    }
  }
  return new Date();
}

function normalizeRoute(route: string) {
  if (typeof route !== "string" || route.trim() === "") {
    return "/";
  }
  const trimmed = route.trim();
  if (trimmed === "/") {
    return trimmed;
  }
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function sanitizeNumber(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.round(value));
}

function sanitizePayload(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.round(value));
}

function normalizeMethod(method: string | undefined) {
  if (!method) {
    return "GET";
  }
  return method.toUpperCase();
}

function normalizeEvent(event: IngestEvent): NormalizedEvent {
  return {
    timestamp: parseTimestamp(event.timestamp),
    route: normalizeRoute(event.route),
    area: event.area,
    statusCode: sanitizeNumber(event.statusCode),
    durationMs: sanitizeNumber(event.durationMs),
    payloadBytes: sanitizePayload(event.payloadBytes),
    method: normalizeMethod(event.method),
  };
}

function scheduleFlush() {
  if (flushTimer) {
    return;
  }
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void startFlush().catch((error) => {
      console.error("[analytics] Failed to flush HTTP analytics queue", error);
    });
  }, FLUSH_INTERVAL_MS);
  if (typeof flushTimer.unref === "function") {
    flushTimer.unref();
  }
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function persistBatch(batch: NormalizedEvent[]) {
  if (batch.length === 0) {
    return;
  }
  let attempt = 0;
  let delayMs = INITIAL_RETRY_DELAY_MS;

  while (attempt < MAX_RETRIES) {
    try {
      await prisma.analyticsHttpRequest.createMany({
        data: batch.map((event) => ({
          timestamp: event.timestamp,
          route: event.route,
          area: event.area,
          statusCode: event.statusCode,
          durationMs: event.durationMs,
          payloadBytes: event.payloadBytes,
          method: event.method,
        })),
      });
      return;
    } catch (error) {
      attempt += 1;
      if (attempt >= MAX_RETRIES) {
        throw error;
      }
      await delay(delayMs);
      delayMs = Math.min(delayMs * 2, 5_000);
    }
  }
}

async function flushQueueInternal() {
  if (!hasDatabaseConnection()) {
    pendingEvents.length = 0;
    return;
  }
  while (pendingEvents.length > 0) {
    const batch = pendingEvents.splice(0, MAX_BATCH_SIZE);
    try {
      await persistBatch(batch);
    } catch (error) {
      pendingEvents.unshift(...batch);
      throw error;
    }
  }
}

function startFlush() {
  if (!activeFlush) {
    activeFlush = flushQueueInternal().finally(() => {
      activeFlush = null;
    });
  }
  return activeFlush;
}

export function ingestHttpRequest(event: IngestEvent) {
  if (!hasDatabaseConnection()) {
    return Promise.resolve();
  }
  const normalized = normalizeEvent(event);
  pendingEvents.push(normalized);

  if (pendingEvents.length >= MAX_BATCH_SIZE) {
    void startFlush().catch((error) => {
      console.error("[analytics] Failed to persist HTTP analytics batch", error);
    });
  } else {
    scheduleFlush();
  }

  return Promise.resolve();
}

export async function flushHttpAnalyticsQueue(options: { suppressErrors?: boolean } = {}) {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (pendingEvents.length === 0 && !activeFlush) {
    return;
  }
  if (options.suppressErrors) {
    await startFlush().catch(() => {});
    return;
  }
  await startFlush();
}

export function getPendingHttpAnalyticsSize() {
  return pendingEvents.length;
}
