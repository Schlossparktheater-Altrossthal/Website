import { z } from "zod";

import { prisma } from "@/lib/prisma";

import { normalizePerformanceRoute, parseUserAgent } from "./performance-samples";

// Fehler für die Statistik: Server-Renderfehler (instrumentation onRequestError) und
// JS-Fehler aus dem Browser. Gespeichert wird nur, was zur Wiedererkennung nötig ist.

export const DEFAULT_ERROR_RETENTION_DAYS = 60;
const CLEANUP_PROBABILITY = 0.02;

export const clientErrorSchema = z.object({
  path: z.string().trim().min(1).max(512),
  message: z.string().trim().min(1).max(500),
  detail: z.string().max(2000).nullish(),
});

type ErrorEventInput = {
  source: "server" | "client";
  route: string;
  message: string;
  detail?: string | null;
  userAgent?: string | null;
  userId?: string | null;
};

export async function recordErrorEvent(input: ErrorEventInput) {
  const parsed = input.userAgent ? parseUserAgent(input.userAgent) : null;
  const now = new Date();
  await prisma.analyticsErrorEvent.create({
    data: {
      createdAt: now,
      source: input.source,
      // Server liefert bereits das Routenmuster (z. B. /mitglieder/[id]); Client-Pfade normalisieren.
      route: input.route.includes("[") ? input.route : normalizePerformanceRoute(input.route),
      message: input.message.trim().slice(0, 500) || "Unbekannter Fehler",
      detail: input.detail?.slice(0, 2000) ?? null,
      browser: parsed
        ? `${parsed.browser}${parsed.browserVersion ? ` ${parsed.browserVersion}` : ""}`
        : null,
      os: parsed?.os ?? null,
      userId: input.userId ?? null,
    },
  });

  if (Math.random() < CLEANUP_PROBABILITY) {
    const cutoff = new Date(now.getTime() - DEFAULT_ERROR_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    await prisma.analyticsErrorEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
  }
}
