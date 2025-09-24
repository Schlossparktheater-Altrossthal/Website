import type {
  AnalyticsHttpRequest,
  AnalyticsHttpPeakHour,
  AnalyticsRequestArea,
  AnalyticsUptimeHeartbeat,
} from "@prisma/client";

export type HttpRequestLike = Pick<
  AnalyticsHttpRequest,
  "timestamp" | "area" | "statusCode" | "durationMs" | "payloadBytes"
> & { timestamp: Date };

export type UptimeHeartbeatLike = Pick<
  AnalyticsUptimeHeartbeat,
  "observedAt" | "isHealthy"
> & { observedAt: Date };

export type HttpSummaryAggregation = {
  windowStart: Date;
  windowEnd: Date;
  totalRequests: number;
  successfulRequests: number;
  clientErrorRequests: number;
  serverErrorRequests: number;
  averageDurationMs: number;
  p95DurationMs: number | null;
  averagePayloadBytes: number;
  uptimePercentage: number | null;
  frontendRequests: number;
  frontendAvgResponseMs: number;
  frontendAvgPayloadBytes: number;
  membersRequests: number;
  membersAvgResponseMs: number;
  apiRequests: number;
  apiAvgResponseMs: number;
  apiErrorRate: number;
};

export type HttpPeakHourAggregation = Pick<
  AnalyticsHttpPeakHour,
  "bucketStart" | "bucketEnd" | "requests" | "share"
> & { bucketStart: Date; bucketEnd: Date };

export type HttpAggregationResult = {
  summary: HttpSummaryAggregation;
  peakHours: HttpPeakHourAggregation[];
};

type AggregateOptions = {
  requests: HttpRequestLike[];
  heartbeats?: UptimeHeartbeatLike[];
  windowStart: Date;
  windowEnd: Date;
  bucketMinutes?: number;
  topBuckets?: number;
};

const DEFAULT_BUCKET_MINUTES = 60;
const DEFAULT_TOP_BUCKETS = 6;

function toTimestamp(value: Date | string | number): number {
  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total <= 0) {
    return 0;
  }
  return total / values.length;
}

function percentile(values: number[], percentileValue: number): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = clampNumber(
    Math.ceil((percentileValue / 100) * sorted.length) - 1,
    0,
    sorted.length - 1,
  );
  const value = sorted[index];
  return Number.isFinite(value) ? value : null;
}

function sanitizeDuration(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.round(value));
}

function sanitizePayload(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, value);
}

function normalizeArea(area: AnalyticsRequestArea | null | undefined): AnalyticsRequestArea {
  if (area === "api" || area === "members" || area === "public") {
    return area;
  }
  return "unknown";
}

function normalizeRequests(requests: HttpRequestLike[]): HttpRequestLike[] {
  return requests
    .map((request) => ({
      timestamp: request.timestamp instanceof Date ? request.timestamp : new Date(request.timestamp),
      area: normalizeArea(request.area),
      statusCode: Number.isFinite(request.statusCode) ? Math.trunc(request.statusCode) : 0,
      durationMs: sanitizeDuration(request.durationMs),
      payloadBytes: sanitizePayload(request.payloadBytes),
    }))
    .filter((request) => Number.isFinite(request.timestamp.getTime()));
}

function normalizeHeartbeats(heartbeats: UptimeHeartbeatLike[] | undefined): UptimeHeartbeatLike[] {
  if (!Array.isArray(heartbeats)) {
    return [];
  }
  return heartbeats
    .map((heartbeat) => ({
      observedAt: heartbeat.observedAt instanceof Date ? heartbeat.observedAt : new Date(heartbeat.observedAt),
      isHealthy: Boolean(heartbeat.isHealthy),
    }))
    .filter((heartbeat) => Number.isFinite(heartbeat.observedAt.getTime()));
}

function calculateUptimePercentage(heartbeats: UptimeHeartbeatLike[]): number | null {
  if (heartbeats.length === 0) {
    return null;
  }
  const total = heartbeats.length;
  const healthy = heartbeats.reduce((count, heartbeat) => (heartbeat.isHealthy ? count + 1 : count), 0);
  if (total === 0) {
    return null;
  }
  return clampNumber(healthy / total, 0, 1) * 100;
}

function groupByArea(requests: HttpRequestLike[]) {
  const groups: Record<AnalyticsRequestArea, HttpRequestLike[]> = {
    api: [],
    members: [],
    public: [],
    unknown: [],
  };
  for (const request of requests) {
    groups[request.area].push(request);
  }
  return groups;
}

function calculateAreaAverage(requests: HttpRequestLike[]): number {
  const durations = requests.map((request) => sanitizeDuration(request.durationMs));
  return average(durations);
}

function calculateAreaPayloadAverage(requests: HttpRequestLike[]): number {
  const payloads = requests.map((request) => sanitizePayload(request.payloadBytes));
  return average(payloads);
}

function calculateAreaErrorRate(requests: HttpRequestLike[]): number {
  if (requests.length === 0) {
    return 0;
  }
  const errors = requests.reduce((count, request) => {
    if (request.statusCode >= 400) {
      return count + 1;
    }
    return count;
  }, 0);
  return clampNumber(errors / requests.length, 0, 1);
}

function aggregatePeakHours(
  requests: HttpRequestLike[],
  totalRequests: number,
  bucketMinutes: number,
  topBuckets: number,
): HttpPeakHourAggregation[] {
  if (requests.length === 0 || totalRequests === 0) {
    return [];
  }

  const bucketSizeMs = Math.max(bucketMinutes, 1) * 60_000;
  const buckets = new Map<number, { count: number; start: number }>();

  for (const request of requests) {
    const timestamp = toTimestamp(request.timestamp);
    const bucketStart = Math.floor(timestamp / bucketSizeMs) * bucketSizeMs;
    const bucket = buckets.get(bucketStart) ?? { count: 0, start: bucketStart };
    bucket.count += 1;
    buckets.set(bucketStart, bucket);
  }

  const entries = Array.from(buckets.values())
    .map((bucket) => {
      const share = clampNumber(bucket.count / totalRequests, 0, 1);
      const end = bucket.start + bucketSizeMs;
      return {
        bucketStart: new Date(bucket.start),
        bucketEnd: new Date(end),
        requests: bucket.count,
        share,
      } satisfies HttpPeakHourAggregation;
    })
    .sort((a, b) => {
      if (b.requests !== a.requests) {
        return b.requests - a.requests;
      }
      return a.bucketStart.getTime() - b.bucketStart.getTime();
    });

  return entries.slice(0, Math.max(topBuckets, 1));
}

export function aggregateHttpMetrics({
  requests,
  heartbeats,
  windowStart,
  windowEnd,
  bucketMinutes = DEFAULT_BUCKET_MINUTES,
  topBuckets = DEFAULT_TOP_BUCKETS,
}: AggregateOptions): HttpAggregationResult {
  const normalizedWindowStart = windowStart instanceof Date ? windowStart : new Date(windowStart);
  const normalizedWindowEnd = windowEnd instanceof Date ? windowEnd : new Date(windowEnd);

  const normalizedRequests = normalizeRequests(requests).filter((request) => {
    const timestamp = request.timestamp.getTime();
    return timestamp >= normalizedWindowStart.getTime() && timestamp <= normalizedWindowEnd.getTime();
  });

  const normalizedHeartbeats = normalizeHeartbeats(heartbeats).filter((heartbeat) => {
    const timestamp = heartbeat.observedAt.getTime();
    return timestamp >= normalizedWindowStart.getTime() && timestamp <= normalizedWindowEnd.getTime();
  });

  const totalRequests = normalizedRequests.length;
  const successfulRequests = normalizedRequests.reduce(
    (count, request) => (request.statusCode >= 400 ? count : count + 1),
    0,
  );
  const clientErrorRequests = normalizedRequests.reduce(
    (count, request) => (request.statusCode >= 400 && request.statusCode < 500 ? count + 1 : count),
    0,
  );
  const serverErrorRequests = normalizedRequests.reduce(
    (count, request) => (request.statusCode >= 500 ? count + 1 : count),
    0,
  );

  const durations = normalizedRequests.map((request) => sanitizeDuration(request.durationMs));
  const payloads = normalizedRequests.map((request) => sanitizePayload(request.payloadBytes));

  const groups = groupByArea(normalizedRequests);

  const summary: HttpSummaryAggregation = {
    windowStart: normalizedWindowStart,
    windowEnd: normalizedWindowEnd,
    totalRequests,
    successfulRequests,
    clientErrorRequests,
    serverErrorRequests,
    averageDurationMs: average(durations),
    p95DurationMs: percentile(durations, 95),
    averagePayloadBytes: average(payloads),
    uptimePercentage: calculateUptimePercentage(normalizedHeartbeats),
    frontendRequests: groups.public.length,
    frontendAvgResponseMs: calculateAreaAverage(groups.public),
    frontendAvgPayloadBytes: calculateAreaPayloadAverage(groups.public),
    membersRequests: groups.members.length,
    membersAvgResponseMs: calculateAreaAverage(groups.members),
    apiRequests: groups.api.length,
    apiAvgResponseMs: calculateAreaAverage(groups.api),
    apiErrorRate: calculateAreaErrorRate(groups.api),
  };

  const peakHours = aggregatePeakHours(
    normalizedRequests,
    totalRequests,
    bucketMinutes,
    topBuckets,
  );

  return { summary, peakHours };
}
