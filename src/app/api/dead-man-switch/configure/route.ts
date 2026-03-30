import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleError } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  POST /api/dead-man-switch/configure                                */
/* ------------------------------------------------------------------ */

const configureSchema = z.object({
  checkInIntervalDays: z.number().int().min(1).max(365),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = requireAuth(request);
    const body = configureSchema.parse(await request.json());

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        checkInIntervalDays: body.checkInIntervalDays,
        lastCheckIn: new Date(),
      },
      select: {
        id: true,
        checkInIntervalDays: true,
        lastCheckIn: true,
      },
    });

    return NextResponse.json({
      message: "Dead man switch configured",
      checkInIntervalDays: user.checkInIntervalDays,
      lastCheckIn: user.lastCheckIn,
    });
  } catch (error) {
    return handleError(error);
  }
}
