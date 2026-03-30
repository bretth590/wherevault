import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleError } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  POST /api/vault/tags                                               */
/* ------------------------------------------------------------------ */

const createTagSchema = z.object({
  name: z.string().min(1).max(50),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a valid hex color (e.g. #ff0000)")
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = requireAuth(request);
    const body = createTagSchema.parse(await request.json());

    // Check uniqueness by userId + name
    const existing = await prisma.tag.findUnique({
      where: { userId_name: { userId, name: body.name } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A tag with this name already exists" },
        { status: 409 },
      );
    }

    const tag = await prisma.tag.create({
      data: {
        userId,
        name: body.name,
        color: body.color ?? null,
      },
    });

    return NextResponse.json({ tag }, { status: 201 });
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
/*  GET /api/vault/tags                                                */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  try {
    const { userId } = requireAuth(request);

    const tags = await prisma.tag.findMany({
      where: { userId },
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ tags });
  } catch (error) {
    return handleError(error);
  }
}
