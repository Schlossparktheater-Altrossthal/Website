import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth(["board", "admin", "tech"]);
    const { isActive, ...updateData } = await request.json();
    
    const template = await prisma.rehearsalTemplate.update({
      where: { id: params.id },
      data: { 
        isActive,
        ...updateData
      }
    });
    
    return NextResponse.json({ success: true, template });
    
  } catch (error) {
    console.error("Error updating template:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth(["board", "admin", "tech"]);
    
    await prisma.rehearsalTemplate.delete({
      where: { id: params.id }
    });
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error("Error deleting template:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
