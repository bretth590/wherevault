import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleError } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  PATCH /api/triggers/[id]                                           */
/* ------------------------------------------------------------------ */

const updateTriggerSchema = z.object({
  delayDays: z.number().int().min(0).max(365).optional(),
  inactivityDays: z.number().int().min(1).max(365).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = requireAuth(request);
    const { id } = await params;
    const body = updateTriggerSchema.parse(await request.json());

    const existing = await prisma.accessTrigger.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Trigger not found" },
        { status: 404 },
      );
    }

    if (existing.status !== "ARMED") {
      return NextResponse.json(
        { error: "Only ARMED triggers can be updated" },
        { status: 400 },
      );
    }

    const updateData: Record<string, any> = {};
    if (body.delayDays !== undefined) updateData.delayDays = body.delayDays;
    if (body.inactivityDays !== undefined)
      updateData.inactivityDays = body.inactivityDays;

    const trigger = await prisma.accessTrigger.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ trigger });
  } catch (error) {
    return handleError(error);
  }
}

/* ------------------------------------------------------------------ */
/*  DELETE /api/triggers/[id]                                          */
/* ------------------------------------------------------------------ */

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = requireAuth(request);
    const { id } = await params;

    const existing = await prisma.accessTrigger.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Trigger not found" },
        { status: 404 },
      );
    }

    if (existing.status === "EXECUTED" || existing.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Cannot cancel a trigger that is already executed or cancelled" },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.accessTrigger.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          ownerId: userId,
          actorId: userId,
          action: "TRIGGER_CANCELLED",
          details: {
            triggerId: id,
            type: existing.type,
          },
        },
      });
    });

    return NextResponse.json({ message: "Trigger cancelled" });
  } catch (error) {
    return handleError(error);
  }
}
