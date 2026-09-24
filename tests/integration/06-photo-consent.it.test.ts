import { beforeEach, describe, expect, it } from "vitest";

import { remindMissingPhotoConsentsAction } from "@/app/(members)/mitglieder/produktionen/actions/reminders";
import { GET as exportCsv } from "@/app/api/photo-consents/export/route";
import { PATCH as adminPatch } from "@/app/api/photo-consents/admin/route";
import { GET as getConsent, POST as postConsent } from "@/app/api/photo-consents/route";
import { POST as onboardingUpdate } from "@/app/api/onboarding/update/route";
import { inviteFormerMembers } from "@/lib/produktionen/returnee-invites";
import { prisma } from "@/lib/prisma";

import {
  createTestShow,
  createTestUser,
  form,
  itState,
  jsonRequest,
  multipartRequest,
  resetItState,
  returneeUpdatePayload,
  signIn,
  signInAsAdmin,
  tokenFromLink,
} from "./harness";

type ConsentBody = { consent: { status: string } | null };

// Testplan Abschnitt 6: Fotoerlaubnis pro Produktion.
describe("Fotoerlaubnis pro Produktion", () => {
  beforeEach(resetItState);

  async function adultIn(...showIds: string[]) {
    const user = await createTestUser();
    await prisma.user.update({
      where: { id: user.id },
      data: { dateOfBirth: new Date("1990-01-01") },
    });
    for (const showId of showIds) {
      await prisma.productionMembership.create({
        data: { showId, userId: user.id, status: "active" },
      });
    }
    return user;
  }

  async function consentStatus() {
    const body = (await (await getConsent()).json()) as ConsentBody & {
      consent: { status?: string } | null;
    };
    return body.consent?.status ?? null;
  }

  it("gilt je ausgewählter Produktion; Freigabe durch Admin", async () => {
    const current = await createTestShow("active");
    const next = await createTestShow("planning");
    const a = await adultIn(current.id, next.id);
    await signIn(a.id);
    itState.cookies.set("active-production", current.id);

    const submit = await postConsent(jsonRequest("/api/photo-consents", "POST", { confirm: true }));
    expect(submit.status, JSON.stringify(await submit.clone().json())).toBe(200);
    expect(await consentStatus()).toBe("pending");

    itState.cookies.set("active-production", next.id);
    expect(await consentStatus()).not.toBe("pending");
    expect(await prisma.photoConsent.count({ where: { userId: a.id, showId: next.id } })).toBe(0);

    const consent = await prisma.photoConsent.findUniqueOrThrow({
      where: { userId_showId: { userId: a.id, showId: current.id } },
    });
    await signInAsAdmin();
    const approve = await adminPatch(
      jsonRequest("/api/photo-consents/admin", "PATCH", { id: consent.id, action: "approve" }),
    );
    expect(approve.status).toBe(200);
    expect(
      await prisma.photoConsent.findUniqueOrThrow({ where: { id: consent.id } }),
    ).toMatchObject({ status: "approved" });
  });

  it("Rückkehrer-Update setzt eine freigegebene Erlaubnis wieder auf „ausstehend“", async () => {
    const admin = await signInAsAdmin();
    const show = await createTestShow("planning");
    const user = await adultIn();
    await prisma.photoConsent.create({
      data: { userId: user.id, showId: show.id, consentGiven: true, status: "approved" },
    });
    const [outcome] = await inviteFormerMembers({
      showId: show.id,
      userIds: [user.id],
      createdById: admin.id,
      sender: null,
    });
    await signIn(user.id);

    const response = await onboardingUpdate(
      multipartRequest("/api/onboarding/update", {
        payload: JSON.stringify(returneeUpdatePayload({ photoConsent: false })),
        onboardingToken: tokenFromLink(outcome?.link),
      }),
    );

    expect(response.status).toBe(200);
    expect(
      await prisma.photoConsent.findUniqueOrThrow({
        where: { userId_showId: { userId: user.id, showId: show.id } },
      }),
    ).toMatchObject({ status: "pending", consentGiven: false, approvedAt: null });
  });

  it("Fotoliste (CSV): UTF-8, Umlaute, eine Zeile je Ensemblemitglied", async () => {
    await signInAsAdmin();
    const show = await createTestShow("active");
    const user = await adultIn(show.id);
    await prisma.user.update({
      where: { id: user.id },
      data: { firstName: "Jürgen", lastName: "Größe" },
    });

    const response = await exportCsv(
      jsonRequest(`/api/photo-consents/export?showId=${show.id}`, "GET"),
    );
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/text\/csv; charset=utf-8/);
    expect(response.headers.get("content-disposition")).toMatch(/fotoerlaubnis-it-produktion/);
    expect(text).toContain("Jürgen");
    expect(text).toContain("Größe");
    expect(text.trim().split(/\r?\n/)).toHaveLength(2); // Kopfzeile + A
  });

  it("Erinnerung geht nur an Aktive ohne (gültige) Erlaubnis", async () => {
    await signInAsAdmin();
    const show = await createTestShow("active");
    const missing = await adultIn(show.id);
    const rejected = await adultIn(show.id);
    const approved = await adultIn(show.id);
    const gone = await adultIn(show.id);
    await prisma.productionMembership.updateMany({
      where: { showId: show.id, userId: gone.id },
      data: { status: "left", leftAt: new Date() },
    });
    await prisma.photoConsent.createMany({
      data: [
        { userId: rejected.id, showId: show.id, status: "rejected" },
        { userId: approved.id, showId: show.id, status: "approved" },
      ],
    });

    const result = await remindMissingPhotoConsentsAction(form({ showId: show.id }));

    expect(result.ok).toBe(true);
    expect(itState.mails.map((mail) => mail.to).sort()).toEqual(
      [missing.email, rejected.email].sort(),
    );
  });

  it("ohne Mailversand (Staging) bricht die Erinnerung ab statt zu senden", async () => {
    await signInAsAdmin();
    const show = await createTestShow("active");
    await adultIn(show.id);
    itState.mailEnabled = false;

    const result = await remindMissingPhotoConsentsAction(form({ showId: show.id }));

    expect(result.ok).toBe(false);
    expect(itState.mails).toHaveLength(0);
  });
});
