import type { MetadataRoute } from "next";

import { readWebsiteSettings, resolveWebsiteSettings } from "@/lib/website-settings";

export const dynamic = "force-dynamic";

const PRODUCTION_URL = "https://sommertheater-altrossthal.de";
const SITEMAP_URL = `${PRODUCTION_URL}/sitemap.xml`;

const publicRouteMap = {
  about: "/ueber-uns",
  mystery: "/mystery",
  schoolCat: "/unsere-schulkatze",
  timeline: "/chronik",
} as const;

const alwaysDisallow = ["/login", "/api/", "/mitglieder/"];
const alwaysAllow = ["/impressum", "/datenschutz"];

export default async function robots(): Promise<MetadataRoute.Robots> {
  if (process.env.NEXT_PUBLIC_BASE_URL !== PRODUCTION_URL) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  try {
    const record = await readWebsiteSettings();
    const visibility = resolveWebsiteSettings(record).pageVisibility.public;

    const dynamicDisallow = Object.entries(publicRouteMap)
      .filter(([key]) => !visibility[key as keyof typeof visibility])
      .map(([, route]) => route);

    return {
      rules: {
        userAgent: "*",
        allow: alwaysAllow,
        disallow: [...alwaysDisallow, ...dynamicDisallow],
      },
      sitemap: SITEMAP_URL,
    };
  } catch (error) {
    console.error("[robots.ts] Fehler beim Laden der WebsiteSettings:", error);
    return {
      rules: {
        userAgent: "*",
        allow: alwaysAllow,
        disallow: ["/"],
      },
      sitemap: SITEMAP_URL,
    };
  }
}
