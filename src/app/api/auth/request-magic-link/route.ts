import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAndSendMagicLink,
  getResetRequestIp,
  MAGIC_LINK_RATE_LIMIT_MESSAGE,
  MAGIC_LINK_SUCCESS_MESSAGE,
  normalizeMagicLinkEmail,
  recordMagicLinkAttempt,
} from "@/lib/auth/magic-link";
import { prisma } from "@/lib/prisma";

const magicLinkRequestSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = magicLinkRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: MAGIC_LINK_SUCCESS_MESSAGE });
  }

  const email = normalizeMagicLinkEmail(parsed.data.email);
  const rateLimit = recordMagicLinkAttempt(email, getResetRequestIp(request));
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { message: MAGIC_LINK_RATE_LIMIT_MESSAGE },
      {
        status: 429,
        headers: rateLimit.retryAfterSeconds
          ? { "Retry-After": String(rateLimit.retryAfterSeconds) }
          : undefined,
      },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ message: MAGIC_LINK_SUCCESS_MESSAGE });
  }

  try {
    await createAndSendMagicLink(request.url, email);
  } catch (error) {
    console.error("[MAGIC LINK ERROR]", error);
  }

  return NextResponse.json({ message: MAGIC_LINK_SUCCESS_MESSAGE });
}
