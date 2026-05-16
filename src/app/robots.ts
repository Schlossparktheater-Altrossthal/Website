import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/mitglieder"],
    },
    sitemap: "https://sommertheater-altrossthal.de/sitemap.xml",
  };
}
