import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";

import { ReturneeUpdateWizard } from "@/components/onboarding/returnee-update-wizard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { calculateInviteStatus, hashInviteToken } from "@/lib/member-invites";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type UpdatePageProps = {
  params: Promise<{ token: string }>;
};

type ExistingProfile = {
  educationCategory: string | null;
  educationSchoolName: string | null;
  educationClassName: string | null;
  educationWorkDescription: string | null;
  educationUniversityName: string | null;
  educationOtherDescription: string | null;
  focus: string | null;
  notes: string | null;
  dietaryPreference: string | null;
  dietaryPreferenceStrictness: string | null;
};

type ExistingDietary = {
  allergen: string;
  level: string;
  symptoms: string | null;
  treatment: string | null;
  note: string | null;
};

type ExistingPreference = {
  code: string;
  domain: string;
  weight: number;
};

export default async function OnboardingReturneeUpdatePage({ params }: UpdatePageProps) {
  const resolvedParams = await params;
  const rawToken = resolvedParams?.token;
  if (!rawToken || typeof rawToken !== "string" || rawToken.length < 10) {
    notFound();
  }

  const token = decodeURIComponent(rawToken.trim());
  if (!token) {
    notFound();
  }

  const tokenHash = /^[0-9a-f]{64}$/i.test(token) ? token.toLowerCase() : hashInviteToken(token);
  const invite = await prisma.memberInvite.findUnique({
    where: { tokenHash },
    include: {
      createdBy: { select: { name: true, email: true } },
      show: { select: { id: true, title: true, year: true, meta: true } },
    },
  });

  if (!invite) {
    return (
      <main id="main" className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="text-3xl font-semibold text-foreground">Einladung nicht gefunden</h1>
          <p className="text-muted-foreground">
            Dieser Einladungslink ist nicht gültig oder wurde bereits entfernt. Bitte wende dich an die Theaterleitung für einen
            neuen Link.
          </p>
        </div>
      </main>
    );
  }

  const status = calculateInviteStatus(invite);
  if (!status.isActive) {
    return (
      <main id="main" className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="text-3xl font-semibold text-foreground">Einladung nicht mehr aktiv</h1>
          <p className="text-muted-foreground">
            Diese Einladung kann nicht mehr verwendet werden. Sie ist entweder abgelaufen, deaktiviert oder es wurden alle Plätze
            genutzt.
          </p>
        </div>
      </main>
    );
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  if (!userId) {
    return (
      <main id="main" className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card shadow-sm">
          <Card>
            <CardHeader className="space-y-2">
              <CardTitle className="text-3xl">Willkommen zurück</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">Melde dich zuerst an, um deine Daten zu aktualisieren.</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild variant="primary" size="lg">
                  <Link href="/login">Anmelden</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href={`/onboarding/${encodeURIComponent(token)}`}>Neues Konto erstellen</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const [existingProfile, existingDietary, existingPreferences, existingPhotoConsent] = await Promise.all([
    prisma.memberOnboardingProfile.findUnique({
      where: { userId },
      select: {
        educationCategory: true,
        educationSchoolName: true,
        educationClassName: true,
        educationWorkDescription: true,
        educationUniversityName: true,
        educationOtherDescription: true,
        focus: true,
        notes: true,
        dietaryPreference: true,
        dietaryPreferenceStrictness: true,
      },
    }),
    prisma.dietaryRestriction.findMany({
      where: { userId, isActive: true },
      select: {
        allergen: true,
        level: true,
        symptoms: true,
        treatment: true,
        note: true,
      },
    }),
    prisma.memberRolePreference.findMany({
      where: { userId },
      select: {
        code: true,
        domain: true,
        weight: true,
      },
      orderBy: [{ domain: "asc" }, { code: "asc" }],
    }),
    prisma.photoConsent.findUnique({
      where: { userId },
      select: { consentGiven: true },
    }),
  ]);

  const profile: ExistingProfile = {
    educationCategory: existingProfile?.educationCategory ?? null,
    educationSchoolName: existingProfile?.educationSchoolName ?? null,
    educationClassName: existingProfile?.educationClassName ?? null,
    educationWorkDescription: existingProfile?.educationWorkDescription ?? null,
    educationUniversityName: existingProfile?.educationUniversityName ?? null,
    educationOtherDescription: existingProfile?.educationOtherDescription ?? null,
    focus: existingProfile?.focus ?? null,
    notes: existingProfile?.notes ?? null,
    dietaryPreference: existingProfile?.dietaryPreference ?? null,
    dietaryPreferenceStrictness: existingProfile?.dietaryPreferenceStrictness ?? null,
  };

  const dietary: ExistingDietary[] = existingDietary.map((entry) => ({
    allergen: entry.allergen,
    level: entry.level,
    symptoms: entry.symptoms,
    treatment: entry.treatment,
    note: entry.note,
  }));

  const preferences: ExistingPreference[] = existingPreferences.map((preference) => ({
    code: preference.code,
    domain: preference.domain,
    weight: preference.weight,
  }));

  return (
    <main id="main" className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <ReturneeUpdateWizard
        existingProfile={profile}
        existingDietary={dietary}
        existingPreferences={preferences}
        existingPhotoConsent={existingPhotoConsent?.consentGiven ?? null}
        isLoggedIn={true}
      />
    </main>
  );
}
