import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import type { z } from "zod";

import { createLogger } from "@/lib/logger";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/rbac";

/**
 * Gemeinsamer Rahmen für API-Routen: Anmeldung, Berechtigung, Eingabeprüfung und
 * Fehlerantworten an einer Stelle. Anders als `requireAuth` leitet er nie auf /login um,
 * sondern antwortet mit JSON (401/403) – Umleitungen haben in API-Antworten nichts verloren.
 */

/** Fehler mit HTTP-Status, den der Handler bewusst an den Client gibt. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export type AuthedSession = Session & { user: NonNullable<Session["user"]> & { id: string } };

export type RouteContext<P> = {
  request: Request;
  session: AuthedSession;
  userId: string;
  params: P;
};

type RouteOptions = {
  /** Name für Logs, z. B. "aversions.post". */
  name: string;
  /** Recht, das zusätzlich zur Anmeldung nötig ist. */
  permission?: string;
  /** Meldung bei unerwarteten Fehlern (500). */
  errorMessage?: string;
  allowImpersonation?: boolean;
};

const logger = createLogger("api");

export function withRoute<P = Record<string, never>>(
  options: RouteOptions,
  handler: (context: RouteContext<P>) => Promise<Response | unknown>,
) {
  return async (request: Request, segment?: { params?: Promise<P> }): Promise<Response> => {
    try {
      const session = await getSession({ allowImpersonation: options.allowImpersonation });
      const userId = session?.user?.id;
      if (!session?.user || !userId) throw new HttpError(401, "Nicht autorisiert");
      if (session.user.isDeactivated) throw new HttpError(403, "Konto deaktiviert");
      if (options.permission && !(await hasPermission(session.user, options.permission))) {
        throw new HttpError(403, "Nicht berechtigt");
      }

      const params = ((await segment?.params) ?? {}) as P;
      const result = await handler({
        request,
        session: session as AuthedSession,
        userId,
        params,
      });
      return result instanceof Response ? result : NextResponse.json(result ?? { ok: true });
    } catch (error) {
      if (error instanceof HttpError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      void logger.error(`[${options.name}] Unerwarteter Fehler`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: options.errorMessage ?? "Interner Fehler" },
        { status: 500 },
      );
    }
  };
}

/** Liest und prüft den JSON-Body; ungültige Eingaben ergeben 400 mit der ersten Zod-Meldung. */
export async function parseJson<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<z.output<S>> {
  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message ?? "Ungültige Eingaben.");
  }
  return parsed.data;
}
