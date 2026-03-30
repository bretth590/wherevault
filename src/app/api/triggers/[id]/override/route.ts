import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleError } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  POST /api/triggers/[id]/override                                   */
/* ------------------------------------------------------------------ */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = requireAuth(request);
    const { id } = await params;

    const trigger = await prisma.accessTrigger.findFirst({
      where: {
        id,
        userId,
        status: "TRIGGERED",
      },
    });

    if (!trigger) {
      return NextResponse.json(
        { error: "Trigger not found or not in TRIGGERED status" },
        { status: 404 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.accessTrigger.update({
        where: { id },
        data: {
          status: "OVERRIDDEN",
          cancelledAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          ownerId: userId,
          actorId: userId,
          action: "TRIGGER_OVERRIDDEN",
          details: {
            triggerId: id,
            type: trigger.type,
          },
        },
      });
    });

    return NextResponse.json({ message: "Trigger overridden successfully" });
  } catch (error) {
    return handleError(error);
  }
}
