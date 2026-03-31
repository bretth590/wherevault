import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleError, getClientIp } from "@/lib/auth";
import { decrypt, unwrapDekFromServerKek } from "@/lib/crypto";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const { userId } = requireAuth(request);
    const { id, itemId } = await params;

    const trustee = await prisma.trustee.findFirst({
      where: { id, trusteeId: userId, status: "ACCEPTED" },
      include: { itemPermissions: true },
    });

    if (!trustee) {
      return NextResponse.json(
        { error: "Trustee record not found or not accepted" },
        { status: 404 },
      );
    }

    if (!trustee.activatedAt) {
      return NextResponse.json(
        { error: "Vault access has not been activated yet" },
        { status: 403 },
      );
    }

    const item = await prisma.vaultItem.findFirst({
      where: { id: itemId, userId: trustee.grantorId },
    });

    if (!item) {
      return NextResponse.json({ error: "Vault item not found" }, { status: 404 });
    }

    // Check permission
    const permittedItemIds = trustee.itemPermissions.map((ip) => ip.vaultItemId);

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

    // Audit log with IP
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
        ipAddress: getClientIp(request),
      },
    });

    // Use vault owner's per-user DEK if available
    const owner = await prisma.user.findUnique({
      where: { id: trustee.grantorId },
      select: { serverEncryptedDek: true },
    });
    const ownerDek = owner?.serverEncryptedDek
      ? unwrapDekFromServerKek(owner.serverEncryptedDek)
      : undefined;
    const decryptedData = JSON.parse(decrypt(item.encryptedData, ownerDek));

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
