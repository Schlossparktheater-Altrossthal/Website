import { NextResponse } from "next/server";
import { z } from "zod";

import { buildSyncEtag, selectBaseline } from "@/lib/sync/server";

const querySchema = z.object({
  scope: z.enum(["inventory", "tickets"]),
  cursor: z.string().optional(),
  limit: z
    .coerce.number({ invalid_type_error: "limit must be a number" })
    .int()
    .min(1)
    .max(500)
    .optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = querySchema.parse({
      scope: url.searchParams.get("scope"),
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    const baseline = await selectBaseline(parsed.scope, {
      cursor: parsed.cursor ?? null,
      limit: parsed.limit ?? null,
    });

    const etag = buildSyncEtag(
      "baseline",
      baseline.scope,
      baseline.serverSeq,
      baseline.nextCursor ?? "",
      baseline.records.length,
    );

    const headers = new Headers({
      "Cache-Control": "private, max-age=0, must-revalidate",
      ETag: `"${etag}"`,
      "Last-Modified": new Date(baseline.capturedAt).toUTCString(),
    });

    return NextResponse.json(baseline, { headers });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid sync baseline request",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    console.error("Failed to select sync baseline", error);
    return NextResponse.json(
      { error: "Failed to create sync baseline" },
      { status: 500 },
    );
  }
}
