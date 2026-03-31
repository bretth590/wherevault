import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleError, getClientIp } from "@/lib/auth";
import { sendTrusteeInviteEmail } from "@/lib/email";

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

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

const trusteeIncludes = {
  trustee: { select: { id: true, email: true, name: true } },
  itemPermissions: {
    include: {
      vaultItem: { select: { id: true, title: true, type: true } },
    },
  },
};

/* ------------------------------------------------------------------ */
/*  POST /api/trustees                                                 */
/* ------------------------------------------------------------------ */

const createTrusteeSchema = z.object({
  trusteeEmail: z.string().email(),
  role: z.enum(["TRUSTEE", "EXECUTOR"]),
  accessLevel: z
    .object({ types: z.array(z.string()).optional() })
    .optional()
    .nullable(),
  itemIds: z.array(z.string().uuid()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = requireAuth(request);
    const body = createTrusteeSchema.parse(await request.json());

    // Cannot assign self as trustee
    const grantor = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (grantor.email === body.trusteeEmail) {
      return NextResponse.json(
        { error: "You cannot add yourself as a trustee" },
        { status: 400 },
      );
    }

    // Find trustee user by email
    const trusteeUser = await prisma.user.findUnique({
      where: { email: body.trusteeEmail },
    });
    if (!trusteeUser) {
      return NextResponse.json(
        { error: "User not found with that email" },
        { status: 404 },
      );
    }

    // Check for existing trustee relationship
    const existing = await prisma.trustee.findUnique({
      where: {
        grantorId_trusteeId: {
          grantorId: userId,
          trusteeId: trusteeUser.id,
        },
      },
    });
    if (existing && existing.status !== "REVOKED") {
      return NextResponse.json(
        { error: "Trustee relationship already exists" },
        { status: 409 },
      );
    }

    // Validate itemIds belong to grantor
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

    // Generate invite token
    const inviteToken = crypto.randomBytes(32).toString("hex");
    const inviteExpiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    );

    const trustee = await prisma.$transaction(async (tx) => {
      let record: any;

      if (existing && existing.status === "REVOKED") {
        // Re-invite a previously revoked trustee
        record = await tx.trustee.update({
          where: { id: existing.id },
          data: {
            role: body.role,
            status: "PENDING",
            inviteToken,
            inviteExpiresAt,
            accessLevel: body.accessLevel ?? Prisma.JsonNull,
            activatedAt: null,
            activatedBy: null,
          },
          include: trusteeIncludes,
        });
      } else {
        record = await tx.trustee.create({
          data: {
            grantorId: userId,
            trusteeId: trusteeUser.id,
            role: body.role,
            status: "PENDING",
            inviteToken,
            inviteExpiresAt,
            accessLevel: body.accessLevel ?? Prisma.JsonNull,
          },
          include: trusteeIncludes,
        });
      }

      // Create item permissions
      if (body.itemIds && body.itemIds.length > 0) {
        // Remove old permissions if re-inviting
        if (existing) {
          await tx.trusteeItemPermission.deleteMany({
            where: { trusteeId: record.id },
          });
        }

        await tx.trusteeItemPermission.createMany({
          data: body.itemIds.map((vaultItemId) => ({
            trusteeId: record.id,
            vaultItemId,
          })),
        });
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          ownerId: userId,
          actorId: userId,
          action: "TRUSTEE_INVITED",
          details: {
            trusteeId: record.id,
            trusteeEmail: body.trusteeEmail,
            role: body.role,
          },
          ipAddress: getClientIp(request),
        },
      });

      // Re-fetch with includes to get item permissions
      return tx.trustee.findUniqueOrThrow({
        where: { id: record.id },
        include: trusteeIncludes,
      });
    });

    // Send invite email
    const grantorName = grantor.name || grantor.email;
    await sendTrusteeInviteEmail(body.trusteeEmail, grantorName, body.role, inviteToken);

    return NextResponse.json(
      { trustee: formatTrustee(trustee) },
      { status: 201 },
    );
  } catch (error) {
    return handleError(error);
  }
}

/* ------------------------------------------------------------------ */
/*  GET /api/trustees                                                  */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  try {
    const { userId } = requireAuth(request);

    const trustees = await prisma.trustee.findMany({
      where: { grantorId: userId },
      include: trusteeIncludes,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      trustees: trustees.map(formatTrustee),
    });
  } catch (error) {
    return handleError(error);
  }
}
