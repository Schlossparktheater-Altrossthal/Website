import { PrismaClient, User, Rehearsal } from '@prisma/client';
import { render } from '@react-email/render';
import { sendEmail } from '../email-service';
import { RehearsalReminderEmail } from '../templates/rehearsal-reminder';

export async function sendRehearsalReminders(prisma: PrismaClient) {
  const oneWeekFromNow = new Date();
  oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);

  // Finde alle Proben, die in einer Woche Anmeldeschluss haben
  const upcomingRehearsals = await prisma.rehearsal.findMany({
    where: {
      registrationDeadline: {
        gte: new Date(), // Deadline noch nicht abgelaufen
        lte: oneWeekFromNow, // Deadline innerhalb einer Woche
      },
    },
  });

  for (const rehearsal of upcomingRehearsals) {
    // Finde alle User ohne Anmeldestatus für diese Probe
    const usersWithoutResponse = await findUsersWithoutResponse(prisma, rehearsal.id);
    
    // Sende Erinnerungen an diese User
    await sendRemindersForRehearsal(rehearsal, usersWithoutResponse);
  }
}

async function findUsersWithoutResponse(
  prisma: PrismaClient,
  rehearsalId: string
): Promise<User[]> {
  const usersWithResponse = await prisma.rehearsalAttendance.findMany({
    where: { rehearsalId },
    select: { userId: true },
  });

  const respondedUserIds = usersWithResponse.map((response) => response.userId);

  // Finde alle aktiven User, die noch nicht geantwortet haben
  return prisma.user.findMany({
    where: {
      id: { notIn: respondedUserIds },
      role: { not: 'admin' }, // Optional: Administratoren ausschließen
    },
  });
}

async function sendRemindersForRehearsal(
  rehearsal: Rehearsal,
  users: User[]
): Promise<void> {
  for (const user of users) {
    if (!user.email) continue;

    const registrationLink = `${process.env.NEXT_PUBLIC_BASE_URL}/proben/${rehearsal.id}`;
    
    const emailHtml = render(
      RehearsalReminderEmail({
        userName: user.name || 'Theatermitglied',
        rehearsalTitle: rehearsal.title,
        rehearsalDate: rehearsal.start,
        rehearsalLocation: rehearsal.location,
        registrationDeadline: rehearsal.registrationDeadline,
        registrationLink,
      })
    );

    await sendEmail({
      to: user.email,
      subject: `Erinnerung: Probenanmeldung für ${rehearsal.title}`,
      html: emailHtml,
    });
  }
}