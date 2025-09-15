import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/mystery`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/chronik`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];
}

