import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleError } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";

/* ------------------------------------------------------------------ */
/*  GET /api/trustees/[id]/vault/[itemId]                              */
/* ------------------------------------------------------------------ */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const { userId } = requireAuth(request);
    const { id, itemId } = await params;

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

    // Find the vault item belonging to the grantor
    const item = await prisma.vaultItem.findFirst({
      where: {
        id: itemId,
        userId: trustee.grantorId,
      },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Vault item not found" },
        { status: 404 },
      );
    }

    // Check permission - by specific item list or by type
    const permittedItemIds = trustee.itemPermissions.map(
      (ip) => ip.vaultItemId,
    );

    if (permittedItemIds.length > 0) {
      if (!permittedItemIds.includes(itemId)) {
        return NextResponse.json(
          { error: "You do not have permission to view this item" },
          { status: 403 },
        );
      }
    } else if (
      trustee.accessLevel &&
      typeof trustee.accessLevel === "object" &&
      !Array.isArray(trustee.accessLevel) &&
      (trustee.accessLevel as any).types
    ) {
      const allowedTypes: string[] = (trustee.accessLevel as any).types;
      if (!allowedTypes.includes(item.type)) {
        return NextResponse.json(
          { error: "You do not have permission to view this item type" },
          { status: 403 },
        );
      }
    }

    // Create audit log for viewing
    await prisma.auditLog.create({
      data: {
        ownerId: trustee.grantorId,
        actorId: userId,
        action: "TRUSTEE_VIEWED_ITEM",
        details: {
          trusteeRecordId: trustee.id,
          vaultItemId: itemId,
          vaultItemTitle: item.title,
        },
      },
    });

    // Decrypt and return item
    const decryptedData = JSON.parse(decrypt(item.encryptedData));

    return NextResponse.json({
      item: {
        id: item.id,
        type: item.type,
        title: item.title,
        data: decryptedData,
        metadata: item.metadata,
        isFavorite: item.isFavorite,
        folderId: item.folderId,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
