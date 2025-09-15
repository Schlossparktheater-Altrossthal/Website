import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(["board", "admin", "tech"]);
    const body = await request.json();
    
    const template = await prisma.rehearsalTemplate.create({
      data: {
        name: body.name,
        description: body.description || null,
        weekday: parseInt(body.weekday),
        startTime: body.startTime,
        endTime: body.endTime,
        location: body.location,
        requiredRoles: body.requiredRoles || {},
        priority: body.priority || "NORMAL",
        isActive: body.isActive !== false
      }
    });
    
    return NextResponse.json({ success: true, template });
    
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    await requireAuth(["board", "admin", "tech"]);
    
    const templates = await prisma.rehearsalTemplate.findMany({
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }]
    });
    
    return NextResponse.json({ templates });
    
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
