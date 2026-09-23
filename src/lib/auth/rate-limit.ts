const ONE_HOUR_IN_MS = 60 * 60 * 1000;
const EMAIL_LIMIT = 3;
const IP_LIMIT = 10;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

const emailAttempts = new Map<string, RateLimitBucket>();
const ipAttempts = new Map<string, RateLimitBucket>();

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return forwardedFor || realIp || "unknown";
}

function pruneExpiredAttempts(now: number) {
  for (const [key, bucket] of emailAttempts.entries()) {
    if (bucket.resetAt <= now) emailAttempts.delete(key);
  }
  for (const [key, bucket] of ipAttempts.entries()) {
    if (bucket.resetAt <= now) ipAttempts.delete(key);
  }
}

function incrementBucket(
  map: Map<string, RateLimitBucket>,
  key: string,
  limit: number,
  now: number,
) {
  const existing = map.get(key);
  const bucket =
    existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + ONE_HOUR_IN_MS };
  bucket.count += 1;
  map.set(key, bucket);

  return {
    allowed: bucket.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

/** Begrenzt Passwort-Mails auf 3 pro Adresse und 10 pro IP und Stunde. */
export function recordPasswordEmailAttempt(
  email: string,
  ip: string,
  now = Date.now(),
): RateLimitResult {
  pruneExpiredAttempts(now);

  const emailResult = incrementBucket(
    emailAttempts,
    `email:${email.trim().toLowerCase()}`,
    EMAIL_LIMIT,
    now,
  );
  const ipResult = incrementBucket(ipAttempts, `ip:${ip}`, IP_LIMIT, now);

  if (emailResult.allowed && ipResult.allowed) {
    return { allowed: true };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(emailResult.retryAfterSeconds, ipResult.retryAfterSeconds),
  };
}

const EMAIL_CHECK_SESSION_LIMIT = 10;
const EMAIL_CHECK_IP_LIMIT = 30;
const emailCheckSessionAttempts = new Map<string, RateLimitBucket>();
const emailCheckIpAttempts = new Map<string, RateLimitBucket>();

/** Begrenzt die E-Mail-Prüfung im Onboarding auf 10 pro Einladungssitzung und 30 pro IP und Stunde. */
export function recordOnboardingEmailCheck(
  sessionToken: string,
  ip: string,
  now = Date.now(),
): RateLimitResult {
  for (const map of [emailCheckSessionAttempts, emailCheckIpAttempts]) {
    for (const [key, bucket] of map.entries()) {
      if (bucket.resetAt <= now) map.delete(key);
    }
  }
  const sessionResult = incrementBucket(
    emailCheckSessionAttempts,
    `session:${sessionToken}`,
    EMAIL_CHECK_SESSION_LIMIT,
    now,
  );
  const ipResult = incrementBucket(emailCheckIpAttempts, `ip:${ip}`, EMAIL_CHECK_IP_LIMIT, now);
  if (sessionResult.allowed && ipResult.allowed) {
    return { allowed: true };
  }
  return {
    allowed: false,
    retryAfterSeconds: Math.max(sessionResult.retryAfterSeconds, ipResult.retryAfterSeconds),
  };
}
