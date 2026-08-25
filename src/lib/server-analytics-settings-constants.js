export const DEFAULT_SERVER_ANALYTICS_SETTINGS = Object.freeze({
  httpWindowMinutes: 1440,
  httpBucketMinutes: 60,
  sessionWindowDays: 30,
  sessionRetentionDays: 180,
  realtimeWindowHours: 24,
  pageWindowDays: 14,
  pageRetentionDays: 60,
});

export const SERVER_ANALYTICS_SETTINGS_LIMITS = Object.freeze({
  httpWindowMinutes: { min: 5, max: 10080 },
  httpBucketMinutes: { min: 1, max: 1440 },
  sessionWindowDays: { min: 1, max: 365 },
  sessionRetentionDays: { min: 1, max: 365 },
  realtimeWindowHours: { min: 1, max: 168 },
  pageWindowDays: { min: 1, max: 365 },
  pageRetentionDays: { min: 1, max: 365 },
});
