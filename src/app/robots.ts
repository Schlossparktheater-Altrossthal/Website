import type { MetadataRoute } from "next";

/**
 * Über diese Domain ist nur der login-geschützte Mitgliederbereich erreichbar;
 * der öffentliche Auftritt läuft auf Drupal. Für Suchmaschinen gibt es hier daher
 * nichts zu indexieren.
 */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
