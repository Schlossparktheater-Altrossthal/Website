import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const actor = session.user as { id?: string; role?: any };
    
    // Nur Board-Mitglieder und Admins dürfen Vorschläge freigeben
    if (!actor.role || !['board', 'admin'].includes(actor.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const payload = await request.json();
    const { proposalId, action, reason } = payload as {
      proposalId?: string;
      action?: 'approve' | 'reject';
      reason?: string;
    };

    if (!proposalId || !action) {
      return NextResponse.json(
        { error: "Proposal ID und Action sind erforderlich" },
        { status: 400 }
      );
    }

    const proposal = await prisma.rehearsalProposal.findUnique({
      where: { id: proposalId },
      include: { show: true }
    });

    if (!proposal) {
      return NextResponse.json(
        { error: "Probenvorschlag nicht gefunden" },
        { status: 404 }
      );
    }

    if (proposal.status !== 'proposed') {
      return NextResponse.json(
        { error: "Dieser Vorschlag wurde bereits bearbeitet" },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      // Erstelle eine neue Probe aus dem Vorschlag
      const rehearsal = await prisma.rehearsal.create({
        data: {
          showId: proposal.showId,
          title: proposal.title,
          start: proposal.date,
          end: new Date(proposal.date.getTime() + (proposal.endTime - proposal.startTime) * 60000),
          location: proposal.location || "Wird noch bekannt gegeben",
          description: "Aus Probenvorschlag erstellt",
          requiredRoles: proposal.requiredRoles,
        }
      });

      // Aktualisiere den Vorschlag
      await prisma.rehearsalProposal.update({
        where: { id: proposalId },
        data: {
          status: 'scheduled',
          approvedAt: new Date(),
          approvedBy: actor.id,
          rehearsalId: rehearsal.id
        }
      });

      return NextResponse.json({
        success: true,
        message: "Probenvorschlag wurde freigegeben und Probe erstellt",
        rehearsal
      });

    } else if (action === 'reject') {
      if (!reason) {
        return NextResponse.json(
          { error: "Für die Ablehnung muss ein Grund angegeben werden" },
          { status: 400 }
        );
      }

      await prisma.rehearsalProposal.update({
        where: { id: proposalId },
        data: {
          status: 'rejected',
          rejectionReason: reason,
          approvedAt: new Date(),
          approvedBy: actor.id
        }
      });

      return NextResponse.json({
        success: true,
        message: "Probenvorschlag wurde abgelehnt"
      });
    }

    return NextResponse.json(
      { error: "Ungültige Action" },
      { status: 400 }
    );

  } catch (error) {
    console.error("Fehler bei der Verarbeitung des Probenvorschlags:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}