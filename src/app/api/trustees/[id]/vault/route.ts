import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleError } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  GET /api/trustees/[id]/vault                                       */
/* ------------------------------------------------------------------ */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = requireAuth(request);
    const { id } = await params;

    // Find trustee record where user is the trustee and status is ACCEPTED
    const trustee = await prisma.trustee.findFirst({
      where: {
        id,
        trusteeId: userId,
        status: "ACCEPTED",
      },
      include: {
        itemPermissions: true,
      },
    });

    if (!trustee) {
      return NextResponse.json(
        { error: "Trustee record not found or not accepted" },
        { status: 404 },
      );
    }

    // Must be activated
    if (!trustee.activatedAt) {
      return NextResponse.json(
        { error: "Vault access has not been activated yet" },
        { status: 403 },
      );
    }

    // Build where clause for vault items
    const where: Prisma.VaultItemWhereInput = {
      userId: trustee.grantorId,
    };

    const permittedItemIds = trustee.itemPermissions.map(
      (ip) => ip.vaultItemId,
    );

    if (permittedItemIds.length > 0) {
      // Filter to only permitted items
      where.id = { in: permittedItemIds };
    } else if (
      trustee.accessLevel &&
      typeof trustee.accessLevel === "object" &&
      !Array.isArray(trustee.accessLevel) &&
      (trustee.accessLevel as any).types
    ) {
      // Filter by access level types
      where.type = {
        in: (trustee.accessLevel as any).types,
      };
    }

    const items = await prisma.vaultItem.findMany({
      where,
      select: {
        id: true,
        type: true,
        title: true,
        metadata: true,
        isFavorite: true,
        folderId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ items });
  } catch (error) {
    return handleError(error);
  }
}
