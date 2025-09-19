import { PrismaClient, Role } from '@prisma/client';
import { addDays, addMinutes, isFriday, isSaturday, isSunday, startOfDay } from 'date-fns';

const MIN_PARTICIPANTS_AVAILABLE = 0.8; // 80% der benötigten Besetzung muss verfügbar sein
const DEFAULT_REQUIRED_ROLES: Role[] = ["cast", "tech"];

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
  if (!process.env.DATABASE_URL) {
    console.warn('[proposal-generator] DATABASE_URL not set; skipping rehearsal proposal generation.');
    return;
  }

  const activeShows = await prisma.show.findMany({
    select: {
      id: true,
      rehearsals: {
        select: { requiredRoles: true },
      },
    },
  });

  type ShowWithRoles = {
    id: string;
    roles: Role[];
  };

  const showsWithRoles: ShowWithRoles[] = activeShows.map((show) => ({
    id: show.id,
    roles: extractRolesFromRehearsals(show.rehearsals),
  }));

  const weekendDays = getNextTwoWeekendDays();

  async function generateProposalsForShow(show: ShowWithRoles) {
    for (const day of weekendDays) {
      const slotDate = startOfDay(day);
      const availableSlots = await findAvailableTimeSlots(slotDate, show);

      for (const slot of availableSlots) {
        await prisma.rehearsalProposal.create({
          data: {
            showId: show.id,
            date: slotDate,
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
    const slotStart = toDateWithMinutes(date, slot.startTime);
    const slotEnd = toDateWithMinutes(date, slot.endTime);

    const overlappingRehearsals = await prisma.rehearsal.count({
      where: {
        start: { lt: slotEnd },
        end: { gt: slotStart },
      },
    });

    if (overlappingRehearsals > 0) {
      return false;
    }

    const existingProposals = await prisma.rehearsalProposal.count({
      where: {
        date,
        startTime: slot.startTime,
        status: {
          in: ['proposed', 'approved'],
        },
      },
    });

    if (existingProposals > 0) {
      return false;
    }

    const availableParticipants = await prisma.availabilityDay.count({
      where: {
        date,
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

    const requiredParticipants = show.roles.length || DEFAULT_REQUIRED_ROLES.length;
    const availabilityRatio = requiredParticipants > 0 ? availableParticipants / requiredParticipants : 0;

    return availabilityRatio >= MIN_PARTICIPANTS_AVAILABLE;
  }

  await Promise.all(showsWithRoles.map((show) => generateProposalsForShow(show)));
}

function extractRolesFromRehearsals(rehearsals: Array<{ requiredRoles: unknown }>): Role[] {
  const roles = new Set<Role>();
  const allowedRoles = new Set<Role>(Object.values(Role));
  rehearsals.forEach((rehearsal) => {
    const { requiredRoles } = rehearsal;
    if (Array.isArray(requiredRoles)) {
      requiredRoles.forEach((role) => {
        if (typeof role === 'string' && allowedRoles.has(role as Role)) {
          roles.add(role as Role);
        }
      });
    }
  });

  return roles.size > 0 ? Array.from(roles) : [...DEFAULT_REQUIRED_ROLES];
}

function getNextTwoWeekendDays(): Date[] {
  const weekendDays: Date[] = [];
  let currentDate = startOfDay(new Date());

  while (weekendDays.length < 6) { // Die nächsten 6 Wochenendtage
    if (isWeekendDay(currentDate)) {
      weekendDays.push(currentDate);
    }
    currentDate = startOfDay(addDays(currentDate, 1));
  }

  return weekendDays;
}

function isWeekendDay(date: Date): boolean {
  return isFriday(date) || isSaturday(date) || isSunday(date);
}

function toDateWithMinutes(day: Date, minutes: number): Date {
  const base = startOfDay(day);
  return addMinutes(base, minutes);
}