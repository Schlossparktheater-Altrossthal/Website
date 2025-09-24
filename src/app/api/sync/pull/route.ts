import { NextResponse } from "next/server";
import { z } from "zod";

import { buildSyncEtag, selectDeltas } from "@/lib/sync/server";

const payloadSchema = z.object({
  scope: z.enum(["inventory", "tickets"]),
  lastServerSeq: z.number().int().nonnegative(),
  limit: z.number().int().min(1).max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = payloadSchema.parse(json);

    const deltas = await selectDeltas(payload.scope, payload.lastServerSeq, {
      limit: payload.limit ?? null,
    });

    const latestEvent = deltas.events.at(-1);
    const etag = buildSyncEtag(
      "deltas",
      deltas.scope,
      deltas.serverSeq,
      deltas.nextCursor ?? "",
      deltas.events.length,
    );

    const headers = new Headers({
      "Cache-Control": "private, max-age=0, must-revalidate",
      ETag: `"${etag}"`,
      "Last-Modified": latestEvent
        ? new Date(latestEvent.occurredAt).toUTCString()
        : new Date().toUTCString(),
    });

    return NextResponse.json(deltas, { headers });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid sync pull payload", issues: error.issues },
        { status: 400 },
      );
    }

    console.error("Failed to select sync deltas", error);
    return NextResponse.json(
      { error: "Failed to load sync events" },
      { status: 500 },
    );
  }
}
