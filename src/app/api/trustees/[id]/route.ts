import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleError } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

const trusteeIncludes = {
  trustee: { select: { id: true, email: true, name: true } },
  itemPermissions: {
    include: {
      vaultItem: { select: { id: true, title: true, type: true } },
    },
  },
};

function formatTrustee(t: any) {
  return {
    id: t.id,
    trustee: t.trustee
      ? { id: t.trustee.id, email: t.trustee.email, name: t.trustee.name }
      : null,
    role: t.role,
    status: t.status,
    accessLevel: t.accessLevel,
    activatedAt: t.activatedAt,
    permittedItems:
      t.itemPermissions?.map((ip: any) => ({
        id: ip.vaultItem.id,
        title: ip.vaultItem.title,
        type: ip.vaultItem.type,
      })) ?? [],
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

/* ------------------------------------------------------------------ */
/*  PATCH /api/trustees/[id]                                           */
/* ------------------------------------------------------------------ */

const updateTrusteeSchema = z.object({
  role: z.enum(["TRUSTEE", "EXECUTOR"]).optional(),
  accessLevel: z
    .object({ types: z.array(z.string()).optional() })
    .optional()
    .nullable(),
  itemIds: z.array(z.string().uuid()).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = requireAuth(request);
    const { id } = await params;
    const body = updateTrusteeSchema.parse(await request.json());

    const existing = await prisma.trustee.findFirst({
      where: { id, grantorId: userId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Trustee not found" },
        { status: 404 },
      );
    }

    // Validate itemIds if provided
    if (body.itemIds && body.itemIds.length > 0) {
      const items = await prisma.vaultItem.findMany({
        where: { id: { in: body.itemIds }, userId },
      });
      if (items.length !== body.itemIds.length) {
        return NextResponse.json(
          { error: "One or more items not found or do not belong to you" },
          { status: 404 },
        );
      }
    }

    const trustee = await prisma.$transaction(async (tx) => {
      // Build update data
      const updateData: Prisma.TrusteeUpdateInput = {};
      if (body.role !== undefined) updateData.role = body.role;
      if (body.accessLevel !== undefined) {
        updateData.accessLevel =
          body.accessLevel === null
            ? Prisma.JsonNull
            : (body.accessLevel as Prisma.InputJsonValue);
      }

      await tx.trustee.update({
        where: { id },
        data: updateData,
      });

      // Replace item permissions if itemIds provided
      if (body.itemIds !== undefined) {
        await tx.trusteeItemPermission.deleteMany({
          where: { trusteeId: id },
        });

        if (body.itemIds.length > 0) {
          await tx.trusteeItemPermission.createMany({
            data: body.itemIds.map((vaultItemId) => ({
              trusteeId: id,
              vaultItemId,
            })),
          });
        }
      }

      return tx.trustee.findUniqueOrThrow({
        where: { id },
        include: trusteeIncludes,
      });
    });

    return NextResponse.json({ trustee: formatTrustee(trustee) });
  } catch (error) {
    return handleError(error);
  }
}

/* ------------------------------------------------------------------ */
/*  DELETE /api/trustees/[id]                                          */
/* ------------------------------------------------------------------ */

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = requireAuth(request);
    const { id } = await params;

    const existing = await prisma.trustee.findFirst({
      where: { id, grantorId: userId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Trustee not found" },
        { status: 404 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.trustee.update({
        where: { id },
        data: {
          status: "REVOKED",
          activatedAt: null,
          activatedBy: null,
          inviteToken: null,
        },
      });

      await tx.auditLog.create({
        data: {
          ownerId: userId,
          actorId: userId,
          action: "TRUSTEE_REVOKED",
          details: {
            trusteeRecordId: id,
            trusteeUserId: existing.trusteeId,
          },
        },
      });
    });

    return NextResponse.json({ message: "Trustee revoked" });
  } catch (error) {
    return handleError(error);
  }
}
