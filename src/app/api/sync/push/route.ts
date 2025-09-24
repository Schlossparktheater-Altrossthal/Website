import { NextResponse } from "next/server";
import { z } from "zod";

import {
  applyIncomingEvents,
  buildSyncEtag,
  type ApplyIncomingEventsResult,
} from "@/lib/sync/server";

const payloadSchema = z.object({
  scope: z.enum(["inventory", "tickets"]),
  clientId: z.string().min(1),
  clientMutationId: z.string().min(1),
  events: z
    .array(
      z.object({
        id: z.string().min(1).optional(),
        dedupeKey: z.string().min(1).optional(),
        type: z.string().min(1),
        payload: z.record(z.any()),
        occurredAt: z.string(),
      }),
    )
    .max(1000),
  lastKnownServerSeq: z.number().int().nonnegative(),
});

function normalizeMutationResult(result: ApplyIncomingEventsResult) {
  if (result.status === "applied") {
    return {
      status: result.status,
      serverSeq: result.serverSeq,
      events: result.events,
      skipped: result.skipped,
      mutation: {
        clientMutationId: result.mutation.clientMutationId,
        scope: result.mutation.scope,
        eventCount: result.mutation.eventCount,
        firstServerSeq: result.mutation.firstServerSeq,
        lastServerSeq: result.mutation.lastServerSeq,
      },
    } as const;
  }

  if (result.status === "duplicate") {
    return {
      status: result.status,
      serverSeq: result.serverSeq,
      events: result.events,
      mutation: {
        clientMutationId: result.mutation.clientMutationId,
        scope: result.mutation.scope,
        eventCount: result.mutation.eventCount,
        firstServerSeq: result.mutation.firstServerSeq,
        lastServerSeq: result.mutation.lastServerSeq,
      },
    } as const;
  }

  return {
    status: result.status,
    serverSeq: result.serverSeq,
    events: result.events,
  } as const;
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = payloadSchema.parse(json);

    const result = await applyIncomingEvents(payload);
    const responseBody = normalizeMutationResult(result);

    const etag = buildSyncEtag(
      "push",
      payload.scope,
      responseBody.serverSeq,
      payload.clientMutationId,
    );

    const headers = new Headers({
      "Cache-Control": "no-store",
      ETag: `"${etag}"`,
      "Last-Modified": new Date().toUTCString(),
      "X-Sync-Status": responseBody.status,
    });

    const status = result.status === "stale" ? 409 : 200;

    return NextResponse.json(responseBody, { status, headers });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid sync push payload", issues: error.issues },
        { status: 400 },
      );
    }

    console.error("Failed to apply incoming events", error);
    return NextResponse.json(
      { error: "Failed to apply sync events" },
      { status: 500 },
    );
  }
}
