import { PrismaClient } from '@prisma/client';
import { addDays, isFriday, isSaturday, isSunday } from 'date-fns';

const MIN_PARTICIPANTS_AVAILABLE = 0.8; // 80% der benötigten Besetzung muss verfügbar sein

type TimeSlot = {
  startTime: number; // Minuten seit Mitternacht
  endTime: number;   // Minuten seit Mitternacht
};

const WEEKEND_TIME_SLOTS: TimeSlot[] = [
  // Freitag Abend
  { startTime: 19 * 60, endTime: 22 * 60 }, // 19:00 - 22:00

  // Samstag
  { startTime: 10 * 60, endTime: 13 * 60 }, // 10:00 - 13:00
  { startTime: 14 * 60, endTime: 17 * 60 }, // 14:00 - 17:00
  { startTime: 19 * 60, endTime: 22 * 60 }, // 19:00 - 22:00

  // Sonntag
  { startTime: 10 * 60, endTime: 13 * 60 }, // 10:00 - 13:00
  { startTime: 14 * 60, endTime: 17 * 60 }, // 14:00 - 17:00
];

export async function generateRehearsalProposals(prisma: PrismaClient) {
  const activeShows = await prisma.show.findMany({
    where: {},
    include: {
      roles: true,
    },
  });

  type ShowWithRoles = (typeof activeShows)[number];

  const nextTwoWeeks = getNextTwoWeekendDays();

  async function generateProposalsForShow(show: ShowWithRoles) {
    for (const date of nextTwoWeeks) {
      const availableSlots = await findAvailableTimeSlots(date, show);

      for (const slot of availableSlots) {
        await prisma.rehearsalProposal.create({
          data: {
            showId: show.id,
            date,
            startTime: slot.startTime,
            endTime: slot.endTime,
            requiredRoles: show.roles,
            status: 'proposed',
          },
        });
      }
    }
  }

  async function findAvailableTimeSlots(date: Date, show: ShowWithRoles): Promise<TimeSlot[]> {
    const availableSlots: TimeSlot[] = [];
    for (const slot of WEEKEND_TIME_SLOTS) {
      const isSlotAvailable = await checkSlotAvailability(date, slot, show);
      if (isSlotAvailable) {
        availableSlots.push(slot);
      }
    }
    return availableSlots;
  }

  async function checkSlotAvailability(date: Date, slot: TimeSlot, show: ShowWithRoles): Promise<boolean> {
    const existingRehearsals = await prisma.rehearsal.findMany({
      where: {
        date: {
          equals: date,
        },
        startTime: {
          equals: slot.startTime,
        },
      },
    });

    if (existingRehearsals.length > 0) {
      return false;
    }

    const existingProposals = await prisma.rehearsalProposal.findMany({
      where: {
        date: {
          equals: date,
        },
        startTime: {
          equals: slot.startTime,
        },
        status: {
          in: ['proposed', 'approved'],
        },
      },
    });

    if (existingProposals.length > 0) {
      return false;
    }

    const availableParticipants = await prisma.availabilityDay.count({
      where: {
        date: {
          equals: date,
        },
        kind: 'FULL_AVAILABLE',
        user: {
          roles: {
            some: {
              role: {
                in: show.roles,
              },
            },
          },
        },
      },
    });

    const requiredParticipants = show.roles.length;
    const availabilityRatio = requiredParticipants > 0 ? availableParticipants / requiredParticipants : 0;

    return availabilityRatio >= MIN_PARTICIPANTS_AVAILABLE;
  }

  await Promise.all(activeShows.map((show) => generateProposalsForShow(show)));
}

function getNextTwoWeekendDays(): Date[] {
  const weekendDays: Date[] = [];
  let currentDate = new Date();
  
  while (weekendDays.length < 6) { // Die nächsten 6 Wochenendtage
    if (isWeekendDay(currentDate)) {
      weekendDays.push(new Date(currentDate));
    }
    currentDate = addDays(currentDate, 1);
  }
  
  return weekendDays;
}

function isWeekendDay(date: Date): boolean {
  return isFriday(date) || isSaturday(date) || isSunday(date);
}