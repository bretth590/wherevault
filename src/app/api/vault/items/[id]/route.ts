import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleError } from "@/lib/auth";
import { encrypt, decrypt, unwrapDekFromServerKek } from "@/lib/crypto";

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

function formatItem(item: any, decryptedData?: unknown) {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    ...(decryptedData !== undefined ? { data: decryptedData } : {}),
    metadata: item.metadata,
    isFavorite: item.isFavorite,
    folderId: item.folderId,
    folder: item.folder ?? null,
    tags: item.tags?.map((vit: any) => vit.tag) ?? [],
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

type RouteContext = { params: Promise<{ id: string }> };

/* ------------------------------------------------------------------ */
/*  GET /api/vault/items/:id                                           */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { userId, edek } = requireAuth(request);
    const { id } = await params;

    const item = await prisma.vaultItem.findFirst({
      where: { id, userId },
      include: {
        tags: { include: { tag: true } },
        folder: true,
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const dek = edek ? unwrapDekFromServerKek(edek) : undefined;
    const decryptedData = JSON.parse(decrypt(item.encryptedData, dek));

    return NextResponse.json({ item: formatItem(item, decryptedData) });
  } catch (error) {
    return handleError(error);
  }
}

/* ------------------------------------------------------------------ */
/*  PATCH /api/vault/items/:id                                         */
/* ------------------------------------------------------------------ */

const updateItemSchema = z.object({
  type: z
    .enum(["PASSWORD", "DOCUMENT", "NOTE", "DIGITAL_ASSET", "OTHER"])
    .optional(),
  title: z.string().min(1).max(500).optional(),
  data: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  isFavorite: z.boolean().optional(),
  folderId: z.string().uuid().optional().nullable(),
  tagIds: z.array(z.string().uuid()).optional(),
});

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { userId, edek } = requireAuth(request);
    const { id } = await params;
    const body = updateItemSchema.parse(await request.json());

    // Ensure item exists and belongs to user
    const existing = await prisma.vaultItem.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Validate folder belongs to user
    if (body.folderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: body.folderId, userId },
      });
      if (!folder) {
        return NextResponse.json(
          { error: "Folder not found" },
          { status: 404 },
        );
      }
    }

    // Validate tags belong to user
    if (body.tagIds && body.tagIds.length > 0) {
      const tags = await prisma.tag.findMany({
        where: { id: { in: body.tagIds }, userId },
      });
      if (tags.length !== body.tagIds.length) {
        return NextResponse.json(
          { error: "One or more tags not found" },
          { status: 404 },
        );
      }
    }

    // Build update payload
    const updateData: Prisma.VaultItemUpdateInput = {};

    if (body.type !== undefined) updateData.type = body.type;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.metadata !== undefined)
      updateData.metadata = body.metadata
        ? (body.metadata as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    if (body.isFavorite !== undefined) updateData.isFavorite = body.isFavorite;

    if (body.data !== undefined) {
      const dek = edek ? unwrapDekFromServerKek(edek) : undefined;
      updateData.encryptedData = encrypt(JSON.stringify(body.data), dek);
    }

    // Handle folder connect / disconnect
    if (body.folderId !== undefined) {
      if (body.folderId === null) {
        updateData.folder = { disconnect: true };
      } else {
        updateData.folder = { connect: { id: body.folderId } };
      }
    }

    // Handle tag replacement inside a transaction
    const item = await prisma.$transaction(async (tx) => {
      if (body.tagIds !== undefined) {
        await tx.vaultItemTag.deleteMany({ where: { vaultItemId: id } });
        if (body.tagIds.length > 0) {
          await tx.vaultItemTag.createMany({
            data: body.tagIds.map((tagId) => ({ vaultItemId: id, tagId })),
          });
        }
      }

      return tx.vaultItem.update({
        where: { id },
        data: updateData,
        include: {
          tags: { include: { tag: true } },
          folder: true,
        },
      });
    });

    return NextResponse.json({ item: formatItem(item) });
  } catch (error) {
    return handleError(error);
  }
}

/* ------------------------------------------------------------------ */
/*  DELETE /api/vault/items/:id                                        */
/* ------------------------------------------------------------------ */

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { userId } = requireAuth(request);
    const { id } = await params;

    const item = await prisma.vaultItem.findFirst({
      where: { id, userId },
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    await prisma.vaultItem.delete({ where: { id } });

    return NextResponse.json({ message: "Item deleted" });
  } catch (error) {
    return handleError(error);
  }
}
