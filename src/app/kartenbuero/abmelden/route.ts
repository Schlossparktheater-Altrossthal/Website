import { NextResponse, type NextRequest } from "next/server";

import { BOX_OFFICE_COOKIE } from "@/lib/karten/access";
import { BOX_OFFICE_PATH } from "@/lib/karten/constants";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(
    new URL(`${BOX_OFFICE_PATH}?abgemeldet=1`, request.nextUrl.origin),
    303,
  );
  response.cookies.delete(BOX_OFFICE_COOKIE);
  return response;
}
