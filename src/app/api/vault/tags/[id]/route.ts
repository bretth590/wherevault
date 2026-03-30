import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleError } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

/* ------------------------------------------------------------------ */
/*  PATCH /api/vault/tags/:id                                          */
/* ------------------------------------------------------------------ */

const updateTagSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a valid hex color (e.g. #ff0000)")
    .optional()
    .nullable(),
});

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { userId } = requireAuth(request);
    const { id } = await params;
    const body = updateTagSchema.parse(await request.json());

    const tag = await prisma.tag.findFirst({
      where: { id, userId },
    });

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Check name uniqueness if changing the name
    if (body.name !== undefined && body.name !== tag.name) {
      const duplicate = await prisma.tag.findUnique({
        where: { userId_name: { userId, name: body.name } },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: "A tag with this name already exists" },
          { status: 409 },
        );
      }
    }

    const updated = await prisma.tag.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.color !== undefined && { color: body.color }),
      },
    });

    return NextResponse.json({ tag: updated });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A tag with this name already exists" },
        { status: 409 },
      );
    }
    return handleError(error);
  }
}

/* ------------------------------------------------------------------ */
/*  DELETE /api/vault/tags/:id                                         */
/* ------------------------------------------------------------------ */

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const { userId } = requireAuth(request);
    const { id } = await params;

    const tag = await prisma.tag.findFirst({
      where: { id, userId },
    });

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    await prisma.tag.delete({ where: { id } });

    return NextResponse.json({ message: "Tag deleted" });
  } catch (error) {
    return handleError(error);
  }
}
