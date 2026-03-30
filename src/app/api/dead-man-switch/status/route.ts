import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleError } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  GET /api/dead-man-switch/status                                    */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  try {
    const { userId } = requireAuth(request);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        checkInIntervalDays: true,
        lastCheckIn: true,
      },
    });

    if (!user.checkInIntervalDays) {
      return NextResponse.json({ enabled: false });
    }

    const lastCheckIn = user.lastCheckIn!;
    const intervalMs = user.checkInIntervalDays * 24 * 60 * 60 * 1000;
    const nextCheckInDue = new Date(lastCheckIn.getTime() + intervalMs);
    const isOverdue = new Date() > nextCheckInDue;

    return NextResponse.json({
      enabled: true,
      checkInIntervalDays: user.checkInIntervalDays,
      lastCheckIn,
      nextCheckInDue,
      isOverdue,
    });
  } catch (error) {
    return handleError(error);
  }
}
