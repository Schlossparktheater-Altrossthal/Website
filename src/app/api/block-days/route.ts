import { NextResponse } from "next/server";
import { Prisma, BlockedDayKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";
import { databaseEnabled } from "@/lib/dev-database";
import {
  DEV_SPERRLISTE_BLOCKED_DAYS_FIXTURE,
  DEV_SPERRLISTE_OFFLINE_MESSAGE,
} from "@/lib/dev-sperrliste-fixture";
import {
  DEFAULT_FREEZE_DAYS,
  readSperrlisteSettings,
  resolveBlocklistSettings,
} from "@/lib/sperrliste-settings";
import {
  isoDate,
  normaliseReason,
  toDateOnly,
  toResponse,
  reasonSchema,
} from "./utils";

type SessionUser = { id?: string } | null | undefined;

const blockDaySchema = z.object({
  date: z.string().regex(isoDate),
  reason: reasonSchema,
  kind: z.nativeEnum(BlockedDayKind).optional(),
});

type BlockDayPayload = z.infer<typeof blockDaySchema>;

export async function GET() {
  const session = await requireAuth();
  const userId = (session.user as SessionUser)?.id;

  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const offline = !databaseEnabled();

  if (!offline && !(await hasPermission(session.user, "mitglieder.sperrliste"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (offline) {
    return NextResponse.json({
      offline: true,
      blockedDays: DEV_SPERRLISTE_BLOCKED_DAYS_FIXTURE,
      message: DEV_SPERRLISTE_OFFLINE_MESSAGE,
    });
  }

  const entries = await prisma.blockedDay.findMany({
    where: { userId },
    orderBy: { date: "asc" },
  });

  return NextResponse.json({
    offline: false,
    blockedDays: entries.map(toResponse),
  });
}

async function resolveFreezeDays() {
  try {
    const record = await readSperrlisteSettings();
    const resolved = resolveBlocklistSettings(record);
    return Number.isFinite(resolved.freezeDays)
      ? Math.max(0, Math.floor(resolved.freezeDays))
      : DEFAULT_FREEZE_DAYS;
  } catch (error) {
    console.error("[block-days:freeze]", error);
    return DEFAULT_FREEZE_DAYS;
  }
}

function formatFreezeDate(date: Date) {
  try {
    return new Intl.DateTimeFormat("de-DE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export async function POST(request: Request) {
  const session = await requireAuth();
  const userId = (session.user as SessionUser)?.id;

  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const offline = !databaseEnabled();

  if (!offline && !(await hasPermission(session.user, "mitglieder.sperrliste"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (offline) {
    return NextResponse.json(
      {
        error:
          "Sperrtermine können im Offline-Demo-Modus nicht bearbeitet werden. Änderungen werden verworfen.",
      },
      { status: 503 },
    );
  }

  let payload: BlockDayPayload;
  try {
    const json = await request.json();
    const parsed = blockDaySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    payload = parsed.data;
  } catch {
    return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  }

  let blockDate: Date;
  try {
    blockDate = toDateOnly(payload.date);
  } catch {
    return NextResponse.json({ error: "Ungültiges Datum" }, { status: 400 });
  }

  const kind = payload.kind ?? BlockedDayKind.BLOCKED;

  if (kind === BlockedDayKind.BLOCKED) {
    try {
      const freezeDays = await resolveFreezeDays();
      if (freezeDays > 0) {
        const todayKey = new Date().toISOString().slice(0, 10);
        const today = toDateOnly(todayKey);
        const cutoff = new Date(today.getTime() + freezeDays * 24 * 60 * 60 * 1000);
        if (blockDate.getTime() < cutoff.getTime()) {
          return NextResponse.json(
            {
              error: `Aus Planungsgründen können Sperrtermine erst ab ${formatFreezeDate(cutoff)} eingetragen werden.`,
            },
            { status: 400 }
          );
        }
      }
    } catch (error) {
      console.error("[block-days:freeze-check]", error);
    }
  }

  try {
    const entry = await prisma.blockedDay.create({
      data: {
        userId,
        date: blockDate,
        reason: normaliseReason(payload.reason),
        kind,
      },
    });

    return NextResponse.json(toResponse(entry));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Für dieses Datum existiert bereits ein Sperrtermin." },
        { status: 409 }
      );
    }

    console.error("[block-days:POST]", error);
    return NextResponse.json(
      { error: "Der Sperrtermin konnte nicht gespeichert werden." },
      { status: 500 }
    );
  }
}
