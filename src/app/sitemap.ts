import type { MetadataRoute } from "next";

/**
 * Der öffentliche Auftritt läuft auf Drupal; die Next.js-App liefert nur noch den
 * login-geschützten Mitgliederbereich aus. Es gibt hier daher keine indexierbaren
 * Seiten mehr. Die Datei bleibt als bewusst leerer Platzhalter erhalten.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [];
}
