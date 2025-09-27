import type {
  AnalyticsRealtimeEvent,
  AnalyticsSession,
  AnalyticsTrafficAttribution,
} from "@prisma/client";

export type AnalyticsSessionLike = Pick<
  AnalyticsSession,
  | "id"
  | "userId"
  | "isMember"
  | "membershipRole"
  | "startedAt"
  | "endedAt"
  | "lastSeenAt"
  | "durationSeconds"
  | "pagePaths"
> & { startedAt: Date; lastSeenAt: Date; pagePaths: string[] };

export type TrafficAttributionLike = Pick<
  AnalyticsTrafficAttribution,
  | "sessionId"
  | "analyticsSessionId"
  | "path"
  | "referrer"
  | "referrerDomain"
  | "utmSource"
  | "utmMedium"
  | "utmCampaign"
  | "utmTerm"
  | "utmContent"
>;

export type RealtimeEventLike = Pick<AnalyticsRealtimeEvent, "eventType" | "occurredAt"> & {
  occurredAt: Date;
};

export type SessionInsight = {
  segment: string;
  avgSessionDurationSeconds: number;
  pagesPerSession: number;
  retentionRate: number;
  share: number;
  conversionRate: number;
};

export type TrafficSourceInsight = {
  channel: string;
  sessions: number;
  avgSessionDurationSeconds: number;
  conversionRate: number;
  changePercent: number;
};

export type RealtimeSummary = {
  windowStart: Date;
  windowEnd: Date;
  totalEvents: number;
  eventCounts: Record<string, number>;
};

export type AggregateSessionMetricsOptions = {
  sessions: AnalyticsSessionLike[];
  traffic: TrafficAttributionLike[];
  realtimeEvents: RealtimeEventLike[];
  now?: Date;
};

export type AggregateSessionMetricsResult = {
  sessionInsights: SessionInsight[];
  trafficSources: TrafficSourceInsight[];
  realtimeSummary: RealtimeSummary;
  sessionSummary: SessionSummary;
};

export type SessionSummary = {
  windowStart: Date;
  windowEnd: Date;
  peakConcurrentUsers: number;
  membersRealtimeEvents: number;
  membersAvgSessionDurationSeconds: number;
};

function toTimestamp(date: Date | string | number): number {
  const instance = date instanceof Date ? date : new Date(date);
  const timestamp = instance.getTime();
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

function clamp(value: number, min: number, max: number): number {
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
  if (!Number.isFinite(total)) {
    return 0;
  }
  return total / values.length;
}

function computeDurationSeconds(session: AnalyticsSessionLike, fallbackEnd: Date): number {
  const start = session.startedAt instanceof Date ? session.startedAt : new Date(session.startedAt);
  const candidateEnd = session.endedAt ?? session.lastSeenAt ?? fallbackEnd;
  const end = candidateEnd instanceof Date ? candidateEnd : new Date(candidateEnd);

  const durationMs = Math.max(0, toTimestamp(end) - toTimestamp(start));
  const durationSeconds = Math.round(durationMs / 1000);
  return Number.isFinite(durationSeconds) && durationSeconds >= 0 ? durationSeconds : 0;
}

function uniquePageCount(session: AnalyticsSessionLike): number {
  const pages = Array.isArray(session.pagePaths) ? session.pagePaths : [];
  const unique = new Set(pages.map((page) => (typeof page === "string" ? page : ""))); // duplicates removed
  unique.delete("");
  const count = unique.size;
  return count > 0 ? count : 1;
}

function normalizeChannel(rawChannel: string | null | undefined): string {
  if (!rawChannel) {
    return "Direct";
  }
  const normalized = rawChannel.trim().toLowerCase();
  if (!normalized) {
    return "Direct";
  }

  if (["email", "newsletter"].includes(normalized)) {
    return "E-Mail";
  }
  if (["social", "social_media", "social-media", "facebook", "instagram", "twitter", "linkedin"].includes(normalized)) {
    return "Social";
  }
  if (["cpc", "ppc", "paidsearch", "sem"].includes(normalized)) {
    return "Paid Search";
  }
  if (["display", "banner"].includes(normalized)) {
    return "Display";
  }
  if (["affiliate"].includes(normalized)) {
    return "Affiliate";
  }
  if (["referral"].includes(normalized)) {
    return "Referral";
  }

  const parts = normalized.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) {
    return "Direct";
  }

  const formatted = parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1));
  if (normalized.includes(".") && !normalized.includes(" ")) {
    return formatted.join(".");
  }

  return formatted.join(" ");
}

function deriveChannel(attribution: TrafficAttributionLike): string {
  if (attribution.utmMedium) {
    return normalizeChannel(attribution.utmMedium);
  }
  if (attribution.utmSource) {
    return normalizeChannel(attribution.utmSource);
  }
  if (attribution.referrerDomain) {
    return normalizeChannel(attribution.referrerDomain);
  }
  return "Direct";
}

export function aggregateSessionMetrics({
  sessions,
  traffic,
  realtimeEvents,
  now: explicitNow,
}: AggregateSessionMetricsOptions): AggregateSessionMetricsResult {
  const now = explicitNow ?? new Date();
  const fallbackEnd = now;

  const totalSessions = sessions.length;
  const sessionById = new Map<string, AnalyticsSessionLike>();
  const returningSessionIds = new Set<string>();
  const sessionsByUser = new Map<string, AnalyticsSessionLike[]>();

  for (const session of sessions) {
    sessionById.set(session.id, session);
    const userId = typeof session.userId === "string" ? session.userId : null;
    if (userId) {
      if (!sessionsByUser.has(userId)) {
        sessionsByUser.set(userId, []);
      }
      sessionsByUser.get(userId)!.push(session);
    }
  }

  for (const [, entries] of sessionsByUser) {
    if (entries.length > 1) {
      for (const entry of entries) {
        returningSessionIds.add(entry.id);
      }
    }
  }

  const segments: Array<{ id: string; label: string; predicate: (session: AnalyticsSessionLike) => boolean }> = [
    { id: "members", label: "Mitglieder", predicate: (session) => Boolean(session.isMember) },
    { id: "guests", label: "Gäste", predicate: (session) => !session.isMember },
    { id: "returning", label: "Wiederkehrend", predicate: (session) => returningSessionIds.has(session.id) },
  ];

  const sessionInsights: SessionInsight[] = segments
    .map((segment) => {
      const matching = sessions.filter(segment.predicate);
      if (matching.length === 0) {
        return null;
      }

      const durations = matching.map((session) =>
        computeDurationSeconds(session, fallbackEnd),
      );
      const avgDuration = Math.round(average(durations));

      const pageCounts = matching.map((session) => uniquePageCount(session));
      const avgPages = Number(average(pageCounts).toFixed(2));

      const returningCount = matching.reduce(
        (count, session) => count + (returningSessionIds.has(session.id) ? 1 : 0),
        0,
      );
      const conversions = matching.reduce((count, session) => count + (session.isMember ? 1 : 0), 0);

      const retentionRate = matching.length
        ? clamp(returningCount / matching.length, 0, 1)
        : 0;
      const share = totalSessions ? clamp(matching.length / totalSessions, 0, 1) : 0;
      const conversionRate = matching.length
        ? clamp(conversions / matching.length, 0, 1)
        : 0;

      return {
        segment: segment.label,
        avgSessionDurationSeconds: avgDuration,
        pagesPerSession: avgPages,
        retentionRate,
        share,
        conversionRate,
      } satisfies SessionInsight;
    })
    .filter((insight): insight is SessionInsight => insight !== null);

  const channelMap = new Map<
    string,
    {
      sessionKeys: Set<string>;
      durations: number[];
      conversions: number;
    }
  >();

  for (const attribution of traffic) {
    const channel = deriveChannel(attribution);
    if (!channelMap.has(channel)) {
      channelMap.set(channel, { sessionKeys: new Set(), durations: [], conversions: 0 });
    }
    const bucket = channelMap.get(channel)!;

    const key = attribution.analyticsSessionId ?? `legacy:${attribution.sessionId}`;
    if (bucket.sessionKeys.has(key)) {
      continue;
    }
    bucket.sessionKeys.add(key);

    const linkedSession = attribution.analyticsSessionId
      ? sessionById.get(attribution.analyticsSessionId)
      : null;

    const duration = linkedSession ? computeDurationSeconds(linkedSession, fallbackEnd) : 0;
    bucket.durations.push(duration);
    if (linkedSession?.isMember) {
      bucket.conversions += 1;
    }
  }

  const trafficSources: TrafficSourceInsight[] = Array.from(channelMap.entries())
    .map(([channel, data]) => {
      const sessionsCount = data.sessionKeys.size;
      const avgDuration = sessionsCount ? Math.round(average(data.durations)) : 0;
      const conversionRate = sessionsCount ? clamp(data.conversions / sessionsCount, 0, 1) : 0;

      return {
        channel,
        sessions: sessionsCount,
        avgSessionDurationSeconds: avgDuration,
        conversionRate,
        changePercent: 0,
      } satisfies TrafficSourceInsight;
    })
    .sort((a, b) => b.sessions - a.sessions || a.channel.localeCompare(b.channel));

  const windowEnd = now;
  const windowStart = new Date(windowEnd.getTime() - 24 * 60 * 60 * 1000);
  const eventCounts: Record<string, number> = {};
  let totalEvents = 0;

  for (const event of realtimeEvents) {
    const timestamp = toTimestamp(event.occurredAt);
    if (timestamp < windowStart.getTime() || timestamp > windowEnd.getTime()) {
      continue;
    }
    totalEvents += 1;
    const type = event.eventType ?? "unknown";
    eventCounts[type] = (eventCounts[type] ?? 0) + 1;
  }

  const memberRealtimeEvents = totalEvents;

  const memberSessions = sessions.filter((session) => Boolean(session.isMember));
  const memberDurations = memberSessions.map((session) => computeDurationSeconds(session, fallbackEnd));
  const membersAvgSessionDurationSeconds = Math.round(average(memberDurations));

  const concurrencyWindowStart = windowStart;
  const concurrencyEvents: Array<{ timestamp: number; delta: number }> = [];

  for (const session of sessions) {
    const start = Math.max(toTimestamp(session.startedAt), concurrencyWindowStart.getTime());
    const rawEnd = session.endedAt ?? session.lastSeenAt ?? fallbackEnd;
    const endTimestamp = Math.max(start, Math.min(toTimestamp(rawEnd), windowEnd.getTime()));

    if (endTimestamp <= concurrencyWindowStart.getTime()) {
      continue;
    }

    concurrencyEvents.push({ timestamp: start, delta: 1 });
    concurrencyEvents.push({ timestamp: endTimestamp, delta: -1 });
  }

  concurrencyEvents.sort((a, b) => {
    if (a.timestamp === b.timestamp) {
      return b.delta - a.delta;
    }
    return a.timestamp - b.timestamp;
  });

  let activeUsers = 0;
  let peakConcurrentUsers = 0;
  for (const event of concurrencyEvents) {
    activeUsers += event.delta;
    if (activeUsers > peakConcurrentUsers) {
      peakConcurrentUsers = activeUsers;
    }
  }

  const realtimeSummary: RealtimeSummary = {
    windowStart,
    windowEnd,
    totalEvents,
    eventCounts,
  };

  return {
    sessionInsights,
    trafficSources,
    realtimeSummary,
    sessionSummary: {
      windowStart,
      windowEnd,
      peakConcurrentUsers,
      membersRealtimeEvents: memberRealtimeEvents,
      membersAvgSessionDurationSeconds,
    },
  };
}
