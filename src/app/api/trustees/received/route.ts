import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleError } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  GET /api/trustees/received                                         */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  try {
    const { userId } = requireAuth(request);

    const trustees = await prisma.trustee.findMany({
      where: {
        trusteeId: userId,
        status: { not: "REVOKED" },
      },
      include: {
        grantor: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      trustees: trustees.map((t) => ({
        id: t.id,
        grantor: t.grantor,
        role: t.role,
        status: t.status,
        activatedAt: t.activatedAt,
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    return handleError(error);
  }
}
