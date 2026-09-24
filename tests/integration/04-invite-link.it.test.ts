import { beforeEach, describe, expect, it } from "vitest";

import { POST as completeOnboarding } from "@/app/api/onboarding/complete/route";
import { POST as emailCheck } from "@/app/api/onboarding/email-check/route";
import { GET as listInvites, POST as createInvite } from "@/app/api/member-invites/route";
import { prisma } from "@/lib/prisma";

import {
  createTestShow,
  createTestUser,
  jsonRequest,
  multipartRequest,
  openInvite,
  resetItState,
  signInAsAdmin,
} from "./harness";

function signupPayload(sessionToken: string, email: string) {
  return {
    sessionToken,
    firstName: "Neu",
    lastName: "Mitglied",
    email,
    password: "geheim123",
    educationCategory: "school_bsz",
    educationSchoolName: "BSZ",
    educationClassName: "10a",
    educationWorkDescription: null,
    educationUniversityName: null,
    educationOtherDescription: null,
    notes: null,
    dateOfBirth: "1995-05-05",
    gender: { option: "no_answer" },
    focus: "acting",
    preferences: [],
    interests: [],
    dietaryPreference: { style: "vegan", strictness: "strict" },
    photoConsent: { consent: true, skipDocument: true },
    dietary: [{ allergen: "Gluten", level: "MODERATE" }],
  };
}

// Testplan Abschnitt 4: Neue Produktion & allgemeiner Einladungslink.
describe("Einladungslink einer neuen Produktion", () => {
  beforeEach(resetItState);

  async function createLink(showId: string) {
    const response = await createInvite(
      jsonRequest("/api/member-invites", "POST", { showId, label: "IT", roles: ["member"] }),
    );
    return { response, body: (await response.json()) as { invite?: { token: string } } };
  }

  it("bietet nur geplante/aktive Produktionen an und lehnt beendete ab", async () => {
    await signInAsAdmin();
    const finished = await createTestShow("finished");
    const planning = await createTestShow("planning");

    const list = (await (await listInvites()).json()) as {
      productions: { id: string; acceptsNewInvites: boolean }[];
    };
    const accepts = new Map(list.productions.map((show) => [show.id, show.acceptsNewInvites]));
    expect(accepts.get(finished.id)).toBe(false);
    expect(accepts.get(planning.id)).toBe(true);

    expect((await createLink(finished.id)).response.status).toBe(400);
    expect((await createLink(planning.id)).response.status).toBe(200);
  });

  it("erkennt bekannte Adressen (Hinweis „Jetzt anmelden“)", async () => {
    await signInAsAdmin();
    const show = await createTestShow("planning");
    const known = await createTestUser();
    const { body } = await createLink(show.id);
    const sessionToken = await openInvite(body.invite!.token);

    const check = async (email: string) =>
      (await (
        await emailCheck(
          jsonRequest("/api/onboarding/email-check", "POST", { sessionToken, email }),
        )
      ).json()) as { known: boolean };

    expect(await check(` ${known.email!.toUpperCase()} `)).toEqual({ known: true });
    expect(await check("niemand-kennt-mich@example.org")).toEqual({ known: false });
  });

  it("E-Mail-Prüfung nur mit gültiger Einladungssitzung", async () => {
    const response = await emailCheck(
      jsonRequest("/api/onboarding/email-check", "POST", {
        sessionToken: "x".repeat(32),
        email: "a@example.org",
      }),
    );
    expect(response.status).toBe(403);
  });

  it("neues Konto ist aktiv im Ensemble, Onboarding abgeschlossen, Fotoerlaubnis ausstehend", async () => {
    await signInAsAdmin();
    const show = await createTestShow("planning");
    const { body } = await createLink(show.id);
    const sessionToken = await openInvite(body.invite!.token);
    const email = `neu-${Date.now()}@example.org`;

    const response = await completeOnboarding(
      multipartRequest("/api/onboarding/complete", {
        payload: JSON.stringify(signupPayload(sessionToken, email)),
      }),
    );
    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(
      await prisma.productionMembership.findUniqueOrThrow({
        where: { showId_userId: { showId: show.id, userId: user.id } },
      }),
    ).toMatchObject({ status: "active" });
    expect(
      await prisma.productionOnboarding.findUniqueOrThrow({
        where: { userId_showId: { userId: user.id, showId: show.id } },
      }),
    ).toMatchObject({ completedAt: expect.any(Date) });
    expect(
      await prisma.photoConsent.findUniqueOrThrow({
        where: { userId_showId: { userId: user.id, showId: show.id } },
      }),
    ).toMatchObject({ status: "pending", consentGiven: true });
    expect(await prisma.dietaryRestriction.count({ where: { userId: user.id } })).toBe(1);

    // Dieselbe Sitzung kann kein zweites Konto anlegen.
    const again = await completeOnboarding(
      multipartRequest("/api/onboarding/complete", {
        payload: JSON.stringify(signupPayload(sessionToken, `zwei-${email}`)),
      }),
    );
    expect(again.status).toBe(409);
  });

  it("lehnt eine bereits registrierte Adresse ab", async () => {
    await signInAsAdmin();
    const show = await createTestShow("planning");
    const known = await createTestUser();
    const { body } = await createLink(show.id);
    const sessionToken = await openInvite(body.invite!.token);

    const response = await completeOnboarding(
      multipartRequest("/api/onboarding/complete", {
        payload: JSON.stringify(signupPayload(sessionToken, known.email!)),
      }),
    );
    expect(response.status).toBe(409);
  });
});
