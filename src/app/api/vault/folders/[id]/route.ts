import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleError } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

/* ------------------------------------------------------------------ */
/*  PATCH /api/vault/folders/:id                                       */
/* ------------------------------------------------------------------ */

const updateFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parentId: z.string().uuid().optional().nullable(),
});

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { userId } = requireAuth(request);
    const { id } = await params;
    const body = updateFolderSchema.parse(await request.json());

    const folder = await prisma.folder.findFirst({
      where: { id, userId },
    });

    if (!folder) {
      return NextResponse.json(
        { error: "Folder not found" },
        { status: 404 },
      );
    }

    // Prevent setting folder as its own parent
    if (body.parentId === id) {
      return NextResponse.json(
        { error: "A folder cannot be its own parent" },
        { status: 400 },
      );
    }

    // Validate parent folder belongs to user
    if (body.parentId) {
      const parent = await prisma.folder.findFirst({
        where: { id: body.parentId, userId },
      });
      if (!parent) {
        return NextResponse.json(
          { error: "Parent folder not found" },
          { status: 404 },
        );
      }
    }

    const updated = await prisma.folder.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.parentId !== undefined && { parentId: body.parentId }),
      },
    });

    return NextResponse.json({ folder: updated });
  } catch (error) {
    return handleError(error);
  }
}

/* ------------------------------------------------------------------ */
/*  DELETE /api/vault/folders/:id                                      */
/* ------------------------------------------------------------------ */

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { userId } = requireAuth(request);
    const { id } = await params;

    const folder = await prisma.folder.findFirst({
      where: { id, userId },
    });

    if (!folder) {
      return NextResponse.json(
        { error: "Folder not found" },
        { status: 404 },
      );
    }

    await prisma.$transaction(async (tx) => {
      // Move child folders up to the deleted folder's parent
      await tx.folder.updateMany({
        where: { parentId: id },
        data: { parentId: folder.parentId },
      });

      // Move items in this folder to no folder
      await tx.vaultItem.updateMany({
        where: { folderId: id },
        data: { folderId: null },
      });

      // Delete the folder
      await tx.folder.delete({ where: { id } });
    });

    return NextResponse.json({ message: "Folder deleted" });
  } catch (error) {
    return handleError(error);
  }
}
