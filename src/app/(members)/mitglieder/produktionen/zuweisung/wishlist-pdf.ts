import { downloadPdf } from "@/lib/pdf/download";
import type { WunschlistePdfData } from "@/lib/pdf/templates/wunschliste";
import type { WishlistData, WishlistPerson } from "@/lib/wishes/wishlist";

export function assignmentText(person: WishlistPerson) {
  return [...person.roles, ...person.departments].join(", ") || null;
}

/** Wunschliste als PDF (Liste je Bereich oder Matrix) für die übergebenen Personen. */
export function downloadWishlistPdf(
  data: WishlistData,
  people: WishlistPerson[],
  layout: WunschlistePdfData["layout"],
) {
  const payload: WunschlistePdfData = {
    generatedAt: new Date().toISOString(),
    production: data.showTitle,
    layout,
    areas: data.areas.map((area) => ({
      title: area.title,
      shortTitle: area.shortTitle,
      domain: area.domain,
    })),
    people: people.map((person) => ({
      name: person.name,
      tag: person.onboardingDone && !person.isReturning ? "neu" : null,
      assignment: assignmentText(person),
      memberSince: person.memberSince,
      interests: person.interests,
      teamNote: person.onboardingNote,
      planningNote: person.note?.text ?? null,
      wishes: data.areas.map((area) => {
        const wish = person.wishes.find((entry) => entry.areaCode === area.code);
        return wish
          ? { level: wish.level, assigned: wish.assigned, entered: Boolean(wish.enteredBy) }
          : null;
      }),
    })),
  };
  return downloadPdf("wunschliste", payload, "wunschliste.pdf");
}
