import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleError } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  POST /api/dead-man-switch/check-in                                 */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  try {
    const { userId } = requireAuth(request);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (!user.checkInIntervalDays) {
      return NextResponse.json(
        { error: "Dead man switch is not configured" },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      // Update last check-in time
      await tx.user.update({
        where: { id: userId },
        data: { lastCheckIn: new Date() },
      });

      // Override any TRIGGERED dead man switch triggers
      await tx.accessTrigger.updateMany({
        where: {
          userId,
          type: "DEAD_MAN_SWITCH",
          status: "TRIGGERED",
        },
        data: {
          status: "OVERRIDDEN",
          cancelledAt: new Date(),
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          ownerId: userId,
          actorId: userId,
          action: "OWNER_CHECK_IN",
          details: {
            timestamp: new Date().toISOString(),
          },
        },
      });
    });

    return NextResponse.json({
      message: "Check-in recorded",
      lastCheckIn: new Date(),
    });
  } catch (error) {
    return handleError(error);
  }
}
