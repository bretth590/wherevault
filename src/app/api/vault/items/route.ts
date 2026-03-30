import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleError } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

function formatItem(item: any) {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    metadata: item.metadata,
    isFavorite: item.isFavorite,
    folderId: item.folderId,
    folder: item.folder ?? null,
    tags: item.tags?.map((vit: any) => vit.tag) ?? [],
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

/* ------------------------------------------------------------------ */
/*  POST /api/vault/items                                              */
/* ------------------------------------------------------------------ */

const createItemSchema = z.object({
  type: z.enum(["PASSWORD", "DOCUMENT", "NOTE", "DIGITAL_ASSET", "OTHER"]),
  title: z.string().min(1).max(500),
  data: z.record(z.unknown()),
  metadata: z.record(z.unknown()).optional(),
  isFavorite: z.boolean().optional(),
  folderId: z.string().uuid().optional().nullable(),
  tagIds: z.array(z.string().uuid()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = requireAuth(request);
    const body = createItemSchema.parse(await request.json());

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

    const encryptedData = encrypt(JSON.stringify(body.data));

    const item = await prisma.vaultItem.create({
      data: {
        userId,
        type: body.type,
        title: body.title,
        encryptedData,
        metadata: body.metadata
          ? (body.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        isFavorite: body.isFavorite ?? false,
        folderId: body.folderId ?? null,
        tags:
          body.tagIds && body.tagIds.length > 0
            ? { create: body.tagIds.map((tagId) => ({ tagId })) }
            : undefined,
      },
      include: {
        tags: { include: { tag: true } },
        folder: true,
      },
    });

    return NextResponse.json({ item: formatItem(item) }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

/* ------------------------------------------------------------------ */
/*  GET /api/vault/items                                               */
/* ------------------------------------------------------------------ */

const listItemsSchema = z.object({
  type: z
    .enum(["PASSWORD", "DOCUMENT", "NOTE", "DIGITAL_ASSET", "OTHER"])
    .optional(),
  folderId: z.string().uuid().optional(),
  tagId: z.string().uuid().optional(),
  favorites: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(request: NextRequest) {
  try {
    const { userId } = requireAuth(request);

    const searchParams = Object.fromEntries(
      request.nextUrl.searchParams.entries(),
    );
    const query = listItemsSchema.parse(searchParams);

    const where: Prisma.VaultItemWhereInput = { userId };

    if (query.type) {
      where.type = query.type;
    }

    if (query.folderId) {
      where.folderId = query.folderId;
    }

    if (query.tagId) {
      where.tags = { some: { tagId: query.tagId } };
    }

    if (query.favorites) {
      where.isFavorite = true;
    }

    if (query.q) {
      where.title = { contains: query.q, mode: "insensitive" };
    }

    const skip = (query.page - 1) * query.limit;

    const [items, total] = await Promise.all([
      prisma.vaultItem.findMany({
        where,
        include: {
          tags: { include: { tag: true } },
          folder: true,
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: query.limit,
      }),
      prisma.vaultItem.count({ where }),
    ]);

    return NextResponse.json({
      items: items.map(formatItem),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
