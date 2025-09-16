import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"

// GET: Hole alle Allergien eines Benutzers
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const userId = session.user.id

    const allergies = await prisma.dietaryRestriction.findMany({
      where: { 
        userId,
        isActive: true 
      },
      orderBy: { allergen: 'asc' }
    })

    return NextResponse.json(allergies)
  } catch (error) {
    return NextResponse.json(
      { error: "Nicht autorisiert" },
      { status: 401 }
    )
  }
}

// POST: Füge eine neue Allergie hinzu oder aktualisiere eine bestehende
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth()
    const userId = session.user.id
    const data = await request.json()

    const allergy = await prisma.dietaryRestriction.upsert({
      where: {
        userId_allergen: {
          userId,
          allergen: data.allergen,
        },
      },
      update: {
        level: data.level,
        symptoms: data.symptoms,
        treatment: data.treatment,
        note: data.note,
        isActive: true,
      },
      create: {
        userId,
        allergen: data.allergen,
        level: data.level,
        symptoms: data.symptoms,
        treatment: data.treatment,
        note: data.note,
      },
    })

    return NextResponse.json(allergy)
  } catch (error) {
    return NextResponse.json(
      { error: "Fehler beim Speichern der Allergie" },
      { status: 500 }
    )
  }
}

// DELETE: Deaktiviere eine Allergie (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth()
    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const allergen = searchParams.get("allergen")

    if (!allergen) {
      return NextResponse.json(
        { error: "Allergen muss angegeben werden" },
        { status: 400 }
      )
    }

    await prisma.dietaryRestriction.update({
      where: {
        userId_allergen: {
          userId,
          allergen,
        },
      },
      data: {
        isActive: false,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Fehler beim Deaktivieren der Allergie" },
      { status: 500 }
    )
  }
}