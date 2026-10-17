import { redirect } from "next/navigation";

import { DIRECTION_HOME_PATH } from "@/lib/regie/access";

/** Ohne Produktion gibt es nichts zu zeigen – zurück zur Übersicht mit Hinweis. */
export function redirectWithoutShow(): never {
  redirect(DIRECTION_HOME_PATH);
}
