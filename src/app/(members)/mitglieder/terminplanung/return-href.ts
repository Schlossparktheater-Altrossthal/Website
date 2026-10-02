// Rücksprung vom Termin-Editor in die Terminplanung mit der zuletzt genutzten Ansicht.
export const PLANNING_PATH = "/mitglieder/terminplanung";

const STORAGE_KEY = "terminplanung:return-href";

export function rememberPlanningHref(href: string) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, href);
  } catch {
    // Privater Modus o. ä.: dann eben ohne Merken.
  }
}

export function planningReturnHref(): string {
  try {
    const href = window.sessionStorage.getItem(STORAGE_KEY);
    if (href?.startsWith(PLANNING_PATH)) return href;
  } catch {
    // ignorieren
  }
  return PLANNING_PATH;
}
