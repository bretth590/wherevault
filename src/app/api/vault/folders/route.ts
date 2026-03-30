import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleError } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  POST /api/vault/folders                                            */
/* ------------------------------------------------------------------ */

const createFolderSchema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.string().uuid().optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = requireAuth(request);
    const body = createFolderSchema.parse(await request.json());

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

    const folder = await prisma.folder.create({
      data: {
        userId,
        name: body.name,
        parentId: body.parentId ?? null,
      },
    });

    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

/* ------------------------------------------------------------------ */
/*  GET /api/vault/folders                                             */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  try {
    const { userId } = requireAuth(request);

    const folders = await prisma.folder.findMany({
      where: { userId },
      include: {
        _count: {
          select: { vaultItems: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ folders });
  } catch (error) {
    return handleError(error);
  }
}
