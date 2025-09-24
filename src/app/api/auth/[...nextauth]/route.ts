import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

type NextAuthHandler = typeof handler;
type NextAuthContext = Parameters<NextAuthHandler>[1];

function isAuthTemporarilyDisabled() {
  const explicitFlag = (process.env.AUTH_DEV_NO_DB ?? process.env.NEXT_PUBLIC_AUTH_DEV_NO_DB ?? "").trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(explicitFlag)) {
    return true;
  }

  return !process.env.DATABASE_URL;
}

function buildDisabledResponse(request: NextRequest, reason: string) {
  const pathname = request.nextUrl.pathname;
  const headers = { "x-auth-disabled": "1", "x-auth-disabled-reason": reason };

  if (pathname.endsWith("/session")) {
    return NextResponse.json(null, { headers });
  }

  if (pathname.endsWith("/providers")) {
    return NextResponse.json({}, { headers });
  }

  return NextResponse.json(
    {
      error: "Authentication temporarily unavailable",
      reason,
    },
    { status: 503, headers },
  );
}

async function safeHandle(request: NextRequest, context: NextAuthContext) {
  if (isAuthTemporarilyDisabled()) {
    return buildDisabledResponse(request, "disabled");
  }

  try {
    return await handler(request, context);
  } catch (error) {
    console.error("[auth] NextAuth handler failed", error);
    return buildDisabledResponse(request, "error");
  }
}

export async function GET(request: NextRequest, context: NextAuthContext) {
  return safeHandle(request, context);
}

export async function POST(request: NextRequest, context: NextAuthContext) {
  return safeHandle(request, context);
}

