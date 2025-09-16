import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateRehearsalProposals } from '@/lib/rehearsals/proposal-generator';

// Diese Route wird jeden Montag um 9:00 Uhr aufgerufen
export async function GET(request: NextRequest) {
  try {
    // Überprüfe den Cron-Secret-Header
    const cronSecret = request.headers.get('x-cron-secret');
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await generateRehearsalProposals(prisma);

    return NextResponse.json({ 
      status: 'success',
      message: 'Probenvorschläge für die nächsten Wochenenden wurden erstellt.'
    });
  } catch (error) {
    console.error('Fehler bei der Generierung der Probenvorschläge:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}