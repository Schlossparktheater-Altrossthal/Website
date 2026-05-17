import type { MetadataRoute } from "next";

import { readWebsiteSettings, resolveWebsiteSettings } from "@/lib/website-settings";

export const dynamic = "force-dynamic";

const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL ?? "https://sommertheater-altrossthal.de").replace(/\/$/, "");

const publicRouteMap = {
  about: "/ueber-uns",
  mystery: "/mystery",
  schoolCat: "/unsere-schulkatze",
  timeline: "/chronik",
} as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const baseEntries: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/impressum`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE_URL}/datenschutz`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];

  try {
    const record = await readWebsiteSettings();
    const visibility = resolveWebsiteSettings(record).pageVisibility.public;

    const dynamicEntries = Object.entries(publicRouteMap)
      .filter(([key]) => visibility[key as keyof typeof visibility])
      .map(([, route]) => ({
        url: `${BASE_URL}${route}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }));

    return [...baseEntries, ...dynamicEntries];
  } catch {
    return baseEntries;
  }
}
