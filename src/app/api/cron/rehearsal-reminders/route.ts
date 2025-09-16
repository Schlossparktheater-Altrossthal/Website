import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendRehearsalReminders } from '@/lib/email/rehearsal-reminders';

// Diese Route wird täglich um 9:00 Uhr von einem Cron-Job aufgerufen
export async function GET(request: NextRequest) {
  try {
    // Überprüfe den Cron-Secret-Header
    const cronSecret = request.headers.get('x-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await sendRehearsalReminders(prisma);

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Fehler beim Versenden der Proben-Erinnerungen:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}