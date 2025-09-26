import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import type { OfflineScope } from "@/lib/offline/types";

const INVENTORY_PERMISSIONS = [
  "mitglieder.lager.technik",
  "mitglieder.lager.kostueme",
] as const satisfies readonly string[];

function logDeniedAccess(scope: OfflineScope, reason: string, userId?: string) {
  const context = userId ? `user=${userId}` : "anonymous";
  console.warn(`[sync] Access denied for scope=${scope}: ${reason} (${context})`);
}

type SessionResult = Awaited<ReturnType<typeof getServerSession>>;

type AuthorizedResult = {
  kind: "ok";
  session: NonNullable<SessionResult>;
};

type UnauthorizedResult = {
  kind: "error";
  response: NextResponse;
};

export type SyncAuthorizationResult = AuthorizedResult | UnauthorizedResult;

export async function authenticateSyncRequest(scope: OfflineScope): Promise<SyncAuthorizationResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    logDeniedAccess(scope, "missing session");
    return {
      kind: "error",
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    } satisfies UnauthorizedResult;
  }

  const userId = typeof session.user.id === "string" ? session.user.id : undefined;

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
