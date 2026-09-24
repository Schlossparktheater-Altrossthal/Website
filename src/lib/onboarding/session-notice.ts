import type { Session } from "next-auth";

import { getUserDisplayName } from "@/lib/names";

export type OnboardingSessionNoticeData = {
  name: string;
  email: string | null;
  authentikLogoutUrl: string | null;
};

/** Daten für den Hinweis „Angemeldet als … – nicht du?“ auf den Onboarding-Seiten. */
export function onboardingSessionNotice(
  session: Session | null,
): OnboardingSessionNoticeData | null {
  const user = session?.user;
  if (!user?.id) return null;
  return {
    name: getUserDisplayName(
      { firstName: user.firstName, lastName: user.lastName, name: user.name, email: user.email },
      "Mitglied",
    ),
    email: user.email ?? null,
    authentikLogoutUrl: session?.authentikLogoutUrl ?? null,
  };
}
