import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleError } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  POST /api/trustees/accept/[token]                                  */
/* ------------------------------------------------------------------ */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { userId } = requireAuth(request);
    const { token } = await params;

    const trustee = await prisma.trustee.findUnique({
      where: { inviteToken: token },
    });

    if (!trustee) {
      return NextResponse.json(
        { error: "Invalid invite token" },
        { status: 404 },
      );
    }

    // Verify the authenticated user is the intended trustee
    if (trustee.trusteeId !== userId) {
      return NextResponse.json(
        { error: "This invitation is not for you" },
        { status: 403 },
      );
    }

    // Check status is PENDING
    if (trustee.status !== "PENDING") {
      return NextResponse.json(
        { error: "This invitation is no longer pending" },
        { status: 400 },
      );
    }

    // Check not expired
    if (trustee.inviteExpiresAt && trustee.inviteExpiresAt < new Date()) {
      return NextResponse.json(
        { error: "This invitation has expired" },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.trustee.update({
        where: { id: trustee.id },
        data: {
          status: "ACCEPTED",
          inviteToken: null,
          inviteExpiresAt: null,
        },
      });

      await tx.auditLog.create({
        data: {
          ownerId: trustee.grantorId,
          actorId: userId,
          action: "TRUSTEE_ACCEPTED",
          details: {
            trusteeRecordId: trustee.id,
          },
        },
      });
    });

    return NextResponse.json({
      message: "Trustee invitation accepted",
    });
  } catch (error) {
    return handleError(error);
  }
}
