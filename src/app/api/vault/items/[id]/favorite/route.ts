import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleError } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

/* ------------------------------------------------------------------ */
/*  PATCH /api/vault/items/:id/favorite                                */
/* ------------------------------------------------------------------ */

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { userId } = requireAuth(request);
    const { id } = await params;

    const item = await prisma.vaultItem.findFirst({
      where: { id, userId },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const updated = await prisma.vaultItem.update({
      where: { id },
      data: { isFavorite: !item.isFavorite },
    });

    return NextResponse.json({
      item: {
        id: updated.id,
        isFavorite: updated.isFavorite,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
