export function generateId(prefix = "id", suffix?: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const base = `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return suffix ? `${base}_${suffix}` : base;
}
