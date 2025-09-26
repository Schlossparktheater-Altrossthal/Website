import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateSyncRequest } from "../auth";
import { buildSyncEtag, selectDeltas } from "@/lib/sync/server";

const payloadSchema = z.object({
  scope: z.enum(["inventory", "tickets"]),
  lastServerSeq: z.number().int().nonnegative(),
  limit: z.number().int().min(1).max(500).optional(),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch (error) {
    console.error("Failed to parse sync pull payload", error);
    return NextResponse.json(
      { error: "Invalid sync pull payload" },
      { status: 400 },
    );
  }

  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid sync pull payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const authResult = await authenticateSyncRequest(parsed.data.scope);
  if (authResult.kind === "error") {
    return authResult.response;
  }

  try {
    const deltas = await selectDeltas(parsed.data.scope, parsed.data.lastServerSeq, {
      limit: parsed.data.limit ?? null,
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
    console.error("Failed to select sync deltas", error);
    return NextResponse.json(
      { error: "Failed to load sync events" },
      { status: 500 },
    );
  }
}
