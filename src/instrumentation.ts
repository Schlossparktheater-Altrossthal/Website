import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startServiceGroupSyncSchedule } = await import("./lib/authentik/service-groups");
    startServiceGroupSyncSchedule();
  }
}

// Serverfehler beim Rendern/in Route-Handlern für die Statistik (Reiter „Fehler“) festhalten.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { recordErrorEvent } = await import("./lib/analytics/error-events");
    const err = error as Error & { digest?: string };
    const userAgent = request.headers["user-agent"];
    await recordErrorEvent({
      source: "server",
      route: context.routePath || request.path.split("?")[0] || "/",
      message: err?.message || "Unbekannter Serverfehler",
      detail: [err?.digest ? `digest ${err.digest}` : null, err?.stack?.slice(0, 1200)]
        .filter(Boolean)
        .join("\n"),
      userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
    });
  } catch (recordError) {
    console.error("[analytics] Failed to record server error", recordError);
  }
};
