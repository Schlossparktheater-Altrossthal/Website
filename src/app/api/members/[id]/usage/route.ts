import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { combineNameParts } from "@/lib/names";

type UsageItem = {
  key: string;
  label: string;
  count: number;
  href?: string | null;
};

type UsageSection = {
  key: string;
  title: string;
  total: number;
  items: UsageItem[];
};

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "mitglieder.rollenverwaltung"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      name: true,
      deactivatedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
  }

  const [
    departmentMemberships,
    characterCastings,
    breakdownAssignments,
    generalTasks,
    departmentTasksAssigned,
    departmentTasksCreated,
    rehearsalInvites,
    rehearsalAttendance,
    attendanceLogsAuthored,
    attendanceLogsTarget,
    blockedDays,
    availabilityEntries,
    availabilityDayEntries,
    availabilityTemplateEntries,
    financeEntriesCreated,
    financeEntriesApproved,
    financeEntriesPaid,
    financeLogsAuthored,
    issuesCreated,
    issuesUpdated,
    issueComments,
    notifications,
    measurements,
    sizes,
    dietaryRestrictions,
    rolePreferences,
    interests,
    photoConsentCount,
    approvedPhotoConsents,
    onboardingProfileCount,
    memberInvitesCreated,
    inviteRedemptions,
    sessions,
    accounts,
    guesses,
    userAppRoles,
    interestsAuthored,
    rehearsalProposalsApproved,
    rehearsalsCreated,
  ] = await prisma.$transaction([
    prisma.departmentMembership.count({ where: { userId: id } }),
    prisma.characterCasting.count({ where: { userId: id } }),
    prisma.sceneBreakdownItem.count({ where: { assignedToId: id } }),
    prisma.task.count({ where: { assigneeId: id } }),
    prisma.departmentTask.count({ where: { assigneeId: id } }),
    prisma.departmentTask.count({ where: { createdById: id } }),
    prisma.rehearsalInvitee.count({ where: { userId: id } }),
    prisma.rehearsalAttendance.count({ where: { userId: id } }),
    prisma.rehearsalAttendanceLog.count({ where: { changedById: id } }),
    prisma.rehearsalAttendanceLog.count({ where: { userId: id } }),
    prisma.blockedDay.count({ where: { userId: id } }),
    prisma.availability.count({ where: { userId: id } }),
    prisma.availabilityDay.count({ where: { userId: id } }),
    prisma.availabilityTemplate.count({ where: { userId: id } }),
    prisma.financeEntry.count({ where: { createdById: id } }),
    prisma.financeEntry.count({ where: { approvedById: id } }),
    prisma.financeEntry.count({ where: { memberPaidById: id } }),
    prisma.financeLog.count({ where: { changedById: id } }),
    prisma.issue.count({ where: { createdById: id } }),
    prisma.issue.count({ where: { updatedById: id } }),
    prisma.issueComment.count({ where: { authorId: id } }),
    prisma.notificationRecipient.count({ where: { userId: id } }),
    prisma.memberMeasurement.count({ where: { userId: id } }),
    prisma.memberSize.count({ where: { userId: id } }),
    prisma.dietaryRestriction.count({ where: { userId: id } }),
    prisma.memberRolePreference.count({ where: { userId: id } }),
    prisma.userInterest.count({ where: { userId: id } }),
    prisma.photoConsent.count({ where: { userId: id } }),
    prisma.photoConsent.count({ where: { approvedById: id } }),
    prisma.memberOnboardingProfile.count({ where: { userId: id } }),
    prisma.memberInvite.count({ where: { createdById: id } }),
    prisma.memberInviteRedemption.count({ where: { userId: id } }),
    prisma.session.count({ where: { userId: id } }),
    prisma.account.count({ where: { userId: id } }),
    prisma.guess.count({ where: { userId: id } }),
    prisma.userAppRole.count({ where: { userId: id } }),
    prisma.interest.count({ where: { createdById: id } }),
    prisma.rehearsalProposal.count({ where: { approvedBy: id } }),
    prisma.rehearsal.count({ where: { createdBy: id } }),
  ]);

  const sections: UsageSection[] = [];
  let total = 0;

  const addSection = (section: UsageSection) => {
    if (!section.items.length) return;
    sections.push(section);
    total += section.total;
  };

  const productionItems: UsageItem[] = [
    { key: "departmentMemberships", label: "Gewerkemitgliedschaften", count: departmentMemberships },
    { key: "characterCastings", label: "Besetzungen in Produktionen", count: characterCastings },
    { key: "breakdownAssignments", label: "Szenische Aufgaben", count: breakdownAssignments },
    { key: "rehearsalsCreated", label: "Erstellte Proben", count: rehearsalsCreated },
  ].filter((item) => item.count > 0);

  addSection({
    key: "productions",
    title: "Produktionen & Rollen",
    total: productionItems.reduce((sum, item) => sum + item.count, 0),
    items: productionItems,
  });

  const rehearsalItems: UsageItem[] = [
    { key: "rehearsalInvites", label: "Probeeinladungen", count: rehearsalInvites },
    { key: "rehearsalAttendance", label: "Anwesenheitseinträge", count: rehearsalAttendance },
    { key: "attendanceLogsAuthored", label: "Anwesenheitsprotokolle (Autor)", count: attendanceLogsAuthored },
    { key: "attendanceLogsTarget", label: "Anwesenheitsprotokolle (Ziel)", count: attendanceLogsTarget },
    { key: "blockedDays", label: "Gesperrte Tage", count: blockedDays },
    { key: "availabilityEntries", label: "Verfügbarkeitszeiträume", count: availabilityEntries },
    { key: "availabilityDays", label: "Tagesverfügbarkeiten", count: availabilityDayEntries },
    { key: "availabilityTemplates", label: "Verfügbarkeitsvorlagen", count: availabilityTemplateEntries },
    { key: "rehearsalProposalsApproved", label: "Freigegebene Probenvorschläge", count: rehearsalProposalsApproved },
  ].filter((item) => item.count > 0);

  addSection({
    key: "rehearsals",
    title: "Proben & Verfügbarkeit",
    total: rehearsalItems.reduce((sum, item) => sum + item.count, 0),
    items: rehearsalItems,
  });

  const taskItems: UsageItem[] = [
    { key: "generalTasks", label: "Allgemeine Aufgaben", count: generalTasks },
    { key: "departmentTasksAssigned", label: "Gewerkaufgaben (zugewiesen)", count: departmentTasksAssigned },
    { key: "departmentTasksCreated", label: "Gewerkaufgaben (erstellt)", count: departmentTasksCreated },
  ].filter((item) => item.count > 0);

  addSection({
    key: "tasks",
    title: "Aufgaben & Zusammenarbeit",
    total: taskItems.reduce((sum, item) => sum + item.count, 0),
    items: taskItems,
  });

  const financeItems: UsageItem[] = [
    { key: "financeEntriesCreated", label: "Finanzvorgänge angelegt", count: financeEntriesCreated },
    { key: "financeEntriesApproved", label: "Finanzvorgänge freigegeben", count: financeEntriesApproved },
    { key: "financeEntriesPaid", label: "Als zahlendes Mitglied hinterlegt", count: financeEntriesPaid },
    { key: "financeLogsAuthored", label: "Finanzprotokolle", count: financeLogsAuthored },
  ].filter((item) => item.count > 0);

  addSection({
    key: "finance",
    title: "Finanzen",
    total: financeItems.reduce((sum, item) => sum + item.count, 0),
    items: financeItems,
  });

  const supportItems: UsageItem[] = [
    { key: "issuesCreated", label: "Supportanfragen erstellt", count: issuesCreated },
    { key: "issuesUpdated", label: "Supportanfragen aktualisiert", count: issuesUpdated },
    { key: "issueComments", label: "Kommentare in Supportanfragen", count: issueComments },
    { key: "notifications", label: "Benachrichtigungen erhalten", count: notifications },
    { key: "interestsAuthored", label: "Interessen erstellt", count: interestsAuthored },
  ].filter((item) => item.count > 0);

  addSection({
    key: "support",
    title: "Support & Kommunikation",
    total: supportItems.reduce((sum, item) => sum + item.count, 0),
    items: supportItems,
  });

  const onboardingItems: UsageItem[] = [
    { key: "memberInvitesCreated", label: "Einladungslinks erstellt", count: memberInvitesCreated },
    { key: "inviteRedemptions", label: "Einladungen eingelöst", count: inviteRedemptions },
    { key: "onboardingProfile", label: "Onboardingprofil", count: onboardingProfileCount },
    { key: "photoConsent", label: "Fotoeinverständnisse", count: photoConsentCount },
    { key: "approvedPhotoConsents", label: "Fotoeinverständnisse geprüft", count: approvedPhotoConsents },
  ].filter((item) => item.count > 0);

  addSection({
    key: "onboarding",
    title: "Onboarding & Freigaben",
    total: onboardingItems.reduce((sum, item) => sum + item.count, 0),
    items: onboardingItems,
  });

  const profileItems: UsageItem[] = [
    { key: "sessions", label: "Aktive Sitzungen", count: sessions },
    { key: "accounts", label: "Verknüpfte Konten", count: accounts },
    { key: "measurements", label: "Hinterlegte Maße", count: measurements },
    { key: "sizes", label: "Konfektionsgrößen", count: sizes },
    { key: "dietaryRestrictions", label: "Ernährungshinweise", count: dietaryRestrictions },
    { key: "rolePreferences", label: "Rollenpräferenzen", count: rolePreferences },
    { key: "interests", label: "Interessensgebiete", count: interests },
    { key: "userAppRoles", label: "Zusätzliche Rollen (Custom)", count: userAppRoles },
    { key: "guesses", label: "Mystery-Gewinnspielteilnahmen", count: guesses },
  ].filter((item) => item.count > 0);

  addSection({
    key: "profile",
    title: "Profil & persönliche Daten",
    total: profileItems.reduce((sum, item) => sum + item.count, 0),
    items: profileItems,
  });

  const displayName =
    combineNameParts(user.firstName, user.lastName) ?? user.name ?? user.email ?? user.id;

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: displayName,
      deactivatedAt: user.deactivatedAt?.toISOString() ?? null,
    },
    total,
    sections,
  });
}
