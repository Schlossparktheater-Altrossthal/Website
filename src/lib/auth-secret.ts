export function getAuthSecret(): string {
  const rawSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  const secret = rawSecret?.trim();

  if (!secret) {
    if (process.env.NODE_ENV === "test") {
      return "test-secret";
    }
    if (process.env.NODE_ENV !== "production") {
      return "development-secret";
    }
    throw new Error("AUTH_SECRET missing");
  }

  return secret;
}
