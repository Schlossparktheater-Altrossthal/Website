import { NextResponse } from "next/server";

import { getAppBaseUrl } from "@/lib/app-url";

import { BOX_OFFICE_COOKIE } from "@/lib/karten/access";
import { BOX_OFFICE_PATH } from "@/lib/karten/constants";

export async function POST() {
  const response = NextResponse.redirect(
    new URL(`${BOX_OFFICE_PATH}?abgemeldet=1`, getAppBaseUrl()),
    303,
  );
  response.cookies.delete(BOX_OFFICE_COOKIE);
  return response;
}
