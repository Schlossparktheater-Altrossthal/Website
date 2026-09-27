import type { MetadataRoute } from "next";

import { PWA_BACKGROUND_COLOR } from "@/lib/pwa/app-icons";

/** Installierbare App für den Mitgliederbereich (Plan docs/benachrichtigungen-plan.md, Phase 4). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/mitglieder",
    name: "Sommertheater Mitglieder",
    short_name: "Sommertheater",
    description: "Mitgliederbereich des Sommertheaters im Schlosspark: Termine, Proben, Gewerke.",
    start_url: "/mitglieder",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "de-DE",
    dir: "ltr",
    background_color: PWA_BACKGROUND_COLOR,
    theme_color: PWA_BACKGROUND_COLOR,
    categories: ["productivity", "entertainment"],
    prefer_related_applications: false,
    icons: [
      { src: "/pwa-icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/pwa-icons/maskable-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Benachrichtigungen",
        url: "/mitglieder/benachrichtigungen",
        icons: [{ src: "/pwa-icons/192", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Meine Termine",
        url: "/mitglieder/meine-proben",
        icons: [{ src: "/pwa-icons/192", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Sperrliste",
        url: "/mitglieder/sperrliste",
        icons: [{ src: "/pwa-icons/192", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
