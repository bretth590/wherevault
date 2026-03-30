import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleError } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  POST /api/triggers                                                 */
/* ------------------------------------------------------------------ */

const createTriggerSchema = z
  .object({
    type: z.enum(["MANUAL", "DEAD_MAN_SWITCH", "INACTIVITY"]),
    delayDays: z.number().int().min(0).max(365).default(0),
    inactivityDays: z.number().int().min(1).max(365).optional(),
  })
  .refine(
    (data) => {
      if (data.type === "INACTIVITY" && data.inactivityDays === undefined) {
        return false;
      }
      return true;
    },
    {
      message: "inactivityDays is required for INACTIVITY trigger type",
      path: ["inactivityDays"],
    },
  );

export async function POST(request: NextRequest) {
  try {
    const { userId } = requireAuth(request);
    const body = createTriggerSchema.parse(await request.json());

    // Check only one active DEAD_MAN_SWITCH allowed
    if (body.type === "DEAD_MAN_SWITCH") {
      const existing = await prisma.accessTrigger.findFirst({
        where: {
          userId,
          type: "DEAD_MAN_SWITCH",
          status: { in: ["ARMED", "TRIGGERED"] },
        },
      });
      if (existing) {
        return NextResponse.json(
          { error: "Only one active dead man switch trigger is allowed" },
          { status: 409 },
        );
      }
    }

    const trigger = await prisma.$transaction(async (tx) => {
      const created = await tx.accessTrigger.create({
        data: {
          userId,
          type: body.type,
          status: "ARMED",
          delayDays: body.delayDays,
          inactivityDays: body.inactivityDays ?? null,
        },
      });

      await tx.auditLog.create({
        data: {
          ownerId: userId,
          actorId: userId,
          action: "TRIGGER_ARMED",
          details: {
            triggerId: created.id,
            type: body.type,
            delayDays: body.delayDays,
          },
        },
      });

      return created;
    });

    return NextResponse.json({ trigger }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

/* ------------------------------------------------------------------ */
/*  GET /api/triggers                                                  */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  try {
    const { userId } = requireAuth(request);

    const triggers = await prisma.accessTrigger.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ triggers });
  } catch (error) {
    return handleError(error);
  }
}
