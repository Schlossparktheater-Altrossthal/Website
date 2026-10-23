import { withRoute } from "@/lib/api/route";
import { NextResponse } from "next/server";

import { isPushConfigured, sendTestPush } from "@/lib/notifications/push";

/** Test-Push an alle eigenen Geräte. */
export const POST = withRoute({ name: "push/test.post" }, async ({ userId }) => {
  if (!isPushConfigured()) {
    return NextResponse.json(
      { error: "Push ist auf diesem Server nicht eingerichtet." },
      { status: 503 },
    );
  }
  return NextResponse.json(await sendTestPush(userId));
});
