import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleError } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  POST /api/triggers/[id]/fire                                       */
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
        type: "MANUAL",
        status: "ARMED",
      },
    });

    if (!trigger) {
      return NextResponse.json(
        { error: "MANUAL trigger not found or not in ARMED status" },
        { status: 404 },
      );
    }

    if (trigger.delayDays === 0) {
      // Immediate execution
      const result = await prisma.$transaction(async (tx) => {
        const now = new Date();

        // Update trigger to EXECUTED
        const updated = await tx.accessTrigger.update({
          where: { id },
          data: {
            status: "EXECUTED",
            triggeredAt: now,
            executedAt: now,
          },
        });

        // Activate all ACCEPTED trustees
        await tx.trustee.updateMany({
          where: {
            grantorId: userId,
            status: "ACCEPTED",
          },
          data: {
            activatedAt: now,
            activatedBy: id,
          },
        });

        // Audit log
        await tx.auditLog.create({
          data: {
            ownerId: userId,
            actorId: userId,
            action: "TRIGGER_EXECUTED",
            details: {
              triggerId: id,
              type: "MANUAL",
              immediate: true,
            },
          },
        });

        return updated;
      });

      return NextResponse.json({
        trigger: result,
        message: "Trigger executed immediately. Trustees have been activated.",
      });
    } else {
      // Delayed execution
      const executesAt = new Date(
        Date.now() + trigger.delayDays * 24 * 60 * 60 * 1000,
      );

      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.accessTrigger.update({
          where: { id },
          data: {
            status: "TRIGGERED",
            triggeredAt: new Date(),
            executesAt,
          },
        });

        await tx.auditLog.create({
          data: {
            ownerId: userId,
            actorId: userId,
            action: "TRIGGER_FIRED",
            details: {
              triggerId: id,
              type: "MANUAL",
              delayDays: trigger.delayDays,
              executesAt: executesAt.toISOString(),
            },
          },
        });

        return updated;
      });

      return NextResponse.json({
        trigger: result,
        message: `Trigger fired. Will execute in ${trigger.delayDays} day(s).`,
      });
    }
  } catch (error) {
    return handleError(error);
  }
}
