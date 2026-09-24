import { NextResponse } from "next/server";

import { createTweakcnThemeCss } from "@/lib/theme/tweakcn";
import { readWebsiteSettings, resolveWebsiteSettings } from "@/lib/website-settings";

export const dynamic = "force-dynamic";

const CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=3600";

/**
 * Öffentliches CSS des aktiven Website-Themes im tweakcn-Format. Das Drupal-Theme bindet es
 * nach seiner eingebauten theme.css ein, damit beide Seiten dasselbe Theme zeigen.
 */
export async function GET() {
  let record: Awaited<ReturnType<typeof readWebsiteSettings>> = null;
  if (process.env.DATABASE_URL) {
    try {
      record = await readWebsiteSettings();
    } catch (error) {
      console.error("Failed to load website theme css", error);
      return NextResponse.json({ error: "Theme konnte nicht geladen werden." }, { status: 503 });
    }
  }

  const { theme } = resolveWebsiteSettings(record);
  const css = `/* Sommertheater Website-Theme: ${theme.name.replace(/\*\//g, "")} */\n${createTweakcnThemeCss(theme.tokens)}`;

  return new NextResponse(css, {
    headers: {
      "Content-Type": "text/css; charset=utf-8",
      "Cache-Control": CACHE_CONTROL,
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
