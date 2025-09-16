import { PrismaClient } from '@prisma/client';
import { addDays, isFriday, isSaturday, isSunday, setHours, setMinutes } from 'date-fns';

const DEFAULT_REHEARSAL_DURATION = 180; // 3 Stunden in Minuten
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
  // Hole alle aktiven Shows
  const activeShows = await prisma.show.findMany({
    where: {
      // Hier können weitere Kriterien für "aktive" Shows hinzugefügt werden
    },
    include: {
      roles: true
    }
  });

  for (const show of activeShows) {
    await generateProposalsForShow(prisma, show);
  }
}

async function generateProposalsForShow(prisma: PrismaClient, show: any) {
  const nextTwoWeeks = getNextTwoWeekendDays();
  
  for (const date of nextTwoWeeks) {
    const availableSlots = await findAvailableTimeSlots(prisma, date, show);
    
    for (const slot of availableSlots) {
      // Erstelle einen Probenvorschlag für jeden verfügbaren Zeitslot
      await prisma.rehearsalProposal.create({
        data: {
          showId: show.id,
          date: date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          requiredRoles: show.roles, // JSON mit benötigten Rollen
          status: 'proposed'
        }
      });
    }
  }
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

async function findAvailableTimeSlots(
  prisma: PrismaClient, 
  date: Date, 
  show: any
): Promise<TimeSlot[]> {
  const availableSlots: TimeSlot[] = [];
  const appropriateSlots = WEEKEND_TIME_SLOTS;

  for (const slot of appropriateSlots) {
    const isSlotAvailable = await checkSlotAvailability(
      prisma,
      date,
      slot,
      show
    );

    if (isSlotAvailable) {
      availableSlots.push(slot);
    }
  }

  return availableSlots;
}

async function checkSlotAvailability(
  prisma: PrismaClient,
  date: Date,
  slot: TimeSlot,
  show: any
): Promise<boolean> {
  // Prüfe ob es bereits eine Probe oder einen Vorschlag für diesen Zeitslot gibt
  const existingRehearsals = await prisma.rehearsal.findMany({
    where: {
      date: {
        equals: date
      },
      startTime: {
        equals: slot.startTime
      }
    }
  });

  if (existingRehearsals.length > 0) {
    return false;
  }

  const existingProposals = await prisma.rehearsalProposal.findMany({
    where: {
      date: {
        equals: date
      },
      startTime: {
        equals: slot.startTime
      },
      status: {
        in: ['proposed', 'approved']
      }
    }
  });

  if (existingProposals.length > 0) {
    return false;
  }

  // Prüfe die Verfügbarkeit der benötigten Besetzung
  const availableParticipants = await prisma.availabilityDay.count({
    where: {
      date: {
        equals: date
      },
      kind: 'FULL_AVAILABLE',
      user: {
        roles: {
          some: {
            role: {
              in: show.roles
            }
          }
        }
      }
    }
  });

  const requiredParticipants = show.roles.length;
  const availabilityRatio = availableParticipants / requiredParticipants;

  return availabilityRatio >= MIN_PARTICIPANTS_AVAILABLE;
}