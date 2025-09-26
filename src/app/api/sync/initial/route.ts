import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateSyncRequest } from "../auth";
import { buildSyncEtag, selectBaseline } from "@/lib/sync/server";

const querySchema = z.object({
  scope: z.enum(["inventory", "tickets"]),
  cursor: z.string().optional(),
  limit: z
    .coerce.number()
    .superRefine((value, ctx) => {
      if (Number.isNaN(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "limit must be a number",
        });
      }
    })
    .int()
    .min(1)
    .max(500)
    .optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parseResult = querySchema.safeParse({
    scope: url.searchParams.get("scope"),
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "Invalid sync baseline request",
        issues: parseResult.error.issues,
      },
      { status: 400 },
    );
  }

  const authResult = await authenticateSyncRequest(request, parseResult.data.scope);
  if (authResult.kind === "error") {
    return authResult.response;
  }

  try {
    const baseline = await selectBaseline(parseResult.data.scope, {
      cursor: parseResult.data.cursor ?? null,
      limit: parseResult.data.limit ?? null,
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
    console.error("Failed to select sync baseline", error);
    return NextResponse.json(
      { error: "Failed to create sync baseline" },
      { status: 500 },
    );
  }
}
