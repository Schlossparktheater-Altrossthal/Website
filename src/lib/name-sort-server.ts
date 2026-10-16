import { cookies } from "next/headers";

import {
  DEFAULT_NAME_SORT,
  NAME_SORT_COOKIE,
  parseNameSortOrder,
  type NameSortOrder,
} from "@/lib/names";

/** Gewählte Sortierung für Personenlisten (Cookie, Standard Vorname). */
export async function getNameSortOrder(): Promise<NameSortOrder> {
  try {
    const store = await cookies();
    return parseNameSortOrder(store.get(NAME_SORT_COOKIE)?.value);
  } catch {
    // Außerhalb eines Requests (Hintergrundjobs) gibt es keine Cookies.
    return DEFAULT_NAME_SORT;
  }
}
