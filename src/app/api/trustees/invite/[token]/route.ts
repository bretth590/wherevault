import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleError } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    const trustee = await prisma.trustee.findUnique({
      where: { inviteToken: token },
      include: {
        grantor: { select: { id: true, email: true, name: true } },
      },
    });

    if (!trustee) {
      return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 404 });
    }

    const expired = trustee.inviteExpiresAt ? trustee.inviteExpiresAt < new Date() : false;

    return NextResponse.json({
      invite: {
        grantorName: trustee.grantor.name || trustee.grantor.email,
        role: trustee.role,
        accessLevel: trustee.accessLevel,
        status: trustee.status,
        expired,
        expiresAt: trustee.inviteExpiresAt,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
