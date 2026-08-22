export function getAuthSecret(): string {
  const rawSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  const secret = rawSecret?.trim();

  if (!secret) {
    if (process.env.NODE_ENV === "test") {
      return "test-secret";
    }
    // During `next build` Next.js evaluates route modules to collect page data
    // while NODE_ENV is already "production". Auth must not fail the build when
    // AUTH_SECRET is only injected at runtime (e.g. in CI).
    if (process.env.NEXT_PHASE === "phase-production-build") {
      return "build-placeholder-secret";
    }
    if (process.env.NODE_ENV !== "production") {
      return "development-secret";
    }
    throw new Error("AUTH_SECRET missing");
  }

  return secret;
}
