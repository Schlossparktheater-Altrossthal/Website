import { NextResponse } from "next/server";
import { createRehearsalAction } from "@/app/(members)/mitglieder/probenplanung/actions";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as {
      title?: string;
      date?: string;
      time?: string;
      location?: string;
    } | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const result = await createRehearsalAction({
      title: body.title ?? "",
      date: body.date ?? "",
      time: body.time ?? "",
      location: body.location,
    });

    if ("error" in result) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/rehearsals] failed", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

