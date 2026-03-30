import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleError } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  POST /api/dead-man-switch/disable                                  */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  try {
    const { userId } = requireAuth(request);

    await prisma.$transaction(async (tx) => {
      // Clear check-in configuration
      await tx.user.update({
        where: { id: userId },
        data: {
          checkInIntervalDays: null,
          lastCheckIn: null,
        },
      });

      // Cancel ARMED or TRIGGERED DEAD_MAN_SWITCH triggers
      await tx.accessTrigger.updateMany({
        where: {
          userId,
          type: "DEAD_MAN_SWITCH",
          status: { in: ["ARMED", "TRIGGERED"] },
        },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
        },
      });
    });

    return NextResponse.json({
      message: "Dead man switch disabled",
    });
  } catch (error) {
    return handleError(error);
  }
}
