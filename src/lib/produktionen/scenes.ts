/** Anzeige von Szenen – überall gleich, damit Listen, PDFs und Benachrichtigungen übereinstimmen. */

export type SceneLabelFields = { identifier: string | null; title: string | null };

/** Vollständig: „1.3 Im Wald“, sonst Kürzel oder Titel, sonst „Szene“. */
export function formatSceneLabel(scene: SceneLabelFields, fallback = "Szene"): string {
  return [scene.identifier, scene.title].filter(Boolean).join(" ") || fallback;
}

/** Kurz: Kürzel „1.3“, ersatzweise Titel. */
export function formatSceneShort(scene: SceneLabelFields, fallback = "–"): string {
  return scene.identifier || scene.title || fallback;
}
