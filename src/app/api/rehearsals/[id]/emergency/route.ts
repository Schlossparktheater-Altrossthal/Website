import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth()
    const userId = session.user.id
    const rehearsalId = params.id
    const { reason } = await request.json()

    // Prüfe ob der Benutzer für diese Probe bereits angemeldet war
    const currentAttendance = await prisma.rehearsalAttendance.findUnique({
      where: {
        rehearsalId_userId: {
          rehearsalId,
          userId,
        },
      },
      include: {
        rehearsal: true,
      },
    })

    if (!currentAttendance) {
      return NextResponse.json(
        { error: "Keine bestehende Anmeldung gefunden" },
        { status: 404 }
      )
    }

    // Prüfe ob die Person vorher zugesagt hatte
    if (currentAttendance.status !== 'yes') {
      return NextResponse.json(
        { error: "Emergency-Absagen sind nur möglich, wenn Sie vorher zugesagt hatten" },
        { status: 400 }
      )
    }

    // Prüfe ob die Anmeldefrist abgelaufen ist
    if (currentAttendance.rehearsal.registrationDeadline && 
        new Date() <= currentAttendance.rehearsal.registrationDeadline) {
      return NextResponse.json(
        { error: "Emergency-Absagen sind erst nach Ablauf der Anmeldefrist möglich" },
        { status: 400 }
      )
    }

    // Aktualisiere den Status und füge die Begründung hinzu
    const updatedAttendance = await prisma.rehearsalAttendance.update({
      where: {
        rehearsalId_userId: {
          rehearsalId,
          userId,
        },
      },
      data: {
        status: 'emergency',
        emergencyReason: reason,
      },
    })

    // Erstelle einen Log-Eintrag
    await prisma.rehearsalAttendanceLog.create({
      data: {
        rehearsalId,
        userId,
        previous: 'yes',
        next: 'emergency',
        comment: reason,
        changedById: userId,
      },
    })

    return NextResponse.json(updatedAttendance)
  } catch (error) {
    return NextResponse.json(
      { error: "Fehler beim Registrieren der Emergency-Absage" },
      { status: 500 }
    )
  }
}