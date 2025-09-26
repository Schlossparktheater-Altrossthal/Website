import { NextResponse } from "next/server";
import { z } from "zod";

import { hasPermission } from "@/lib/permissions";
import type { OfflineScope } from "@/lib/offline/types";
import { verifySyncToken } from "@/lib/sync/tokens";
import { getSession } from "@/lib/rbac";

const INVENTORY_PERMISSIONS = [
  "mitglieder.lager.technik",
  "mitglieder.lager.kostueme",
] as const satisfies readonly string[];

const tokenIssue = z.object({
  code: z.literal("invalid_token"),
  message: z.string(),
});

function logDeniedAccess(scope: OfflineScope, reason: string, userId?: string) {
  const context = userId ? `user=${userId}` : "anonymous";
  console.warn(`[sync] Access denied for scope=${scope}: ${reason} (${context})`);
}

type SessionResult = Awaited<ReturnType<typeof getSession>>;

type AuthorizedResult = {
  kind: "ok";
  session: NonNullable<SessionResult>;
};

type UnauthorizedResult = {
  kind: "error";
  response: NextResponse;
};

export type SyncAuthorizationResult = AuthorizedResult | UnauthorizedResult;

function unauthorized(message: string, status: 401 | 403) {
  return NextResponse.json({ error: message }, { status });
}

export async function authenticateSyncRequest(
  request: Request,
  scope: OfflineScope,
): Promise<SyncAuthorizationResult> {
  const tokenHeader = request.headers.get("x-sync-token");
  const claims = verifySyncToken(tokenHeader);

  if (!claims) {
    const issue = tokenIssue.safeParse(
      tokenHeader
        ? { code: "invalid_token" as const, message: "Invalid sync token" }
        : { code: "invalid_token" as const, message: "Missing sync token" },
    );

    if (issue.success) {
      logDeniedAccess(scope, issue.data.message.toLowerCase());
    } else {
      logDeniedAccess(scope, "invalid sync token");
    }

    return {
      kind: "error",
      response: unauthorized("Sync authentication required", 401),
    } satisfies UnauthorizedResult;
  }

  const session = await getSession();

  if (!session?.user) {
    logDeniedAccess(scope, "missing session", claims.userId);
    return {
      kind: "error",
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    } satisfies UnauthorizedResult;
  }

  const userId = typeof session.user.id === "string" ? session.user.id : undefined;

  if (!userId) {
    logDeniedAccess(scope, "session missing user id", claims.userId);
    return {
      kind: "error",
      response: unauthorized("Session is incomplete", 403),
    } satisfies UnauthorizedResult;
  }

  if (claims.userId !== userId) {
    logDeniedAccess(scope, `token user mismatch (token=${claims.userId})`, userId);
    return {
      kind: "error",
      response: unauthorized("Sync token does not match active session", 403),
    } satisfies UnauthorizedResult;
  }

  if (session.user.isDeactivated) {
    logDeniedAccess(scope, "deactivated account", userId);
    return {
      kind: "error",
      response: NextResponse.json({ error: "Account disabled" }, { status: 403 }),
    } satisfies UnauthorizedResult;
  }

  const permissionChecks: Array<Promise<boolean>> = [
    hasPermission(session.user, "mitglieder.scan"),
  ];

  if (scope === "inventory") {
    for (const permission of INVENTORY_PERMISSIONS) {
      permissionChecks.push(hasPermission(session.user, permission));
    }
  }

  const results = await Promise.all(permissionChecks);
  const [canScan, ...inventoryPermissions] = results;

  if (!canScan) {
    logDeniedAccess(scope, "missing permission mitglieder.scan", userId);
    return {
      kind: "error",
      response: NextResponse.json({ error: "Missing permission" }, { status: 403 }),
    } satisfies UnauthorizedResult;
  }

  if (scope === "inventory" && !inventoryPermissions.some(Boolean)) {
    logDeniedAccess(scope, "missing inventory permission", userId);
    return {
      kind: "error",
      response: NextResponse.json({ error: "Missing inventory permission" }, { status: 403 }),
    } satisfies UnauthorizedResult;
  }

  return { kind: "ok", session: session } satisfies AuthorizedResult;
}
