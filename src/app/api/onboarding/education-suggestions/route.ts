import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { hashInviteToken, isInviteUsable } from "@/lib/member-invites";

import { readStoredEducation, type BszCampusId } from "@/lib/education/schools";
import { prisma } from "@/lib/prisma";

// Neue Mitglieder haben im Onboarding noch kein Konto: Zugriff mit Anmeldung oder mit einem
// gültigen Onboarding-Link (`?token=`, Klartext oder Hash). Geliefert werden nur Häufigkeiten; freie Texte (Schulen, Berufe, Hochschulen) erst ab MIN_SHARED_COUNT Nennungen,
// damit keine Einzelangaben durchsickern. Klassenbezeichnungen am BSZ sind unkritisch.
const MIN_SHARED_COUNT = 2;
const MAX_ENTRIES = 12;

type Counter = Map<string, { name: string; count: number }>;

function count(counter: Counter, raw: string) {
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 60) return;
  const key = name.toLowerCase();
  const entry = counter.get(key);
  if (entry) entry.count += 1;
  else counter.set(key, { name, count: 1 });
}

function top(counter: Counter, minCount = 1) {
  return Array.from(counter.values())
    .filter((entry) => entry.count >= minCount)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "de"))
    .slice(0, MAX_ENTRIES)
    .map((entry) => entry.name);
}

async function hasAccess(request: NextRequest) {
  const session = await auth();
  if (session?.user?.id) return true;
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token) return false;
  const tokenHash = /^[0-9a-f]{64}$/i.test(token) ? token.toLowerCase() : hashInviteToken(token);
  const invite = await prisma.memberInvite.findUnique({
    where: { tokenHash },
    select: { expiresAt: true, maxUses: true, usageCount: true, isDisabled: true },
  });
  return Boolean(invite && isInviteUsable(invite));
}

export async function GET(request: NextRequest) {
  if (!(await hasAccess(request))) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const profiles = await prisma.memberOnboardingProfile.findMany({
    select: {
      educationCategory: true,
      educationSchoolName: true,
      educationClassName: true,
      educationWorkDescription: true,
      educationUniversityName: true,
      educationOtherDescription: true,
      background: true,
      backgroundClass: true,
    },
  });

  const classes: Record<BszCampusId, Counter> = { altrossthal: new Map(), canaletto: new Map() };
  const schools: Counter = new Map();
  const work: Counter = new Map();
  const universities: Counter = new Map();

  for (const profile of profiles) {
    const value = readStoredEducation(profile);
    if (value.kind === "school" && value.campus && value.campus !== "other") {
      count(classes[value.campus], value.className);
    } else if (value.kind === "school" && value.campus === "other") {
      count(schools, value.schoolName);
    } else if (value.kind === "work") {
      count(work, value.workDescription);
    } else if (value.kind === "university") {
      count(universities, value.universityName);
    }
  }

  return NextResponse.json(
    {
      classes: { altrossthal: top(classes.altrossthal), canaletto: top(classes.canaletto) },
      schools: top(schools, MIN_SHARED_COUNT),
      work: top(work, MIN_SHARED_COUNT),
      universities: top(universities, MIN_SHARED_COUNT),
    },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
