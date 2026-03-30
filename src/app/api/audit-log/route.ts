import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleError } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  GET /api/audit-log                                                 */
/* ------------------------------------------------------------------ */

const querySchema = z.object({
  action: z
    .enum([
      "TRUSTEE_INVITED",
      "TRUSTEE_ACCEPTED",
      "TRUSTEE_REVOKED",
      "TRIGGER_ARMED",
      "TRIGGER_FIRED",
      "TRIGGER_EXECUTED",
      "TRIGGER_CANCELLED",
      "TRIGGER_OVERRIDDEN",
      "TRUSTEE_ACCESS_ACTIVATED",
      "TRUSTEE_VIEWED_ITEM",
      "OWNER_CHECK_IN",
      "DEAD_MAN_SWITCH_WARNING",
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(request: NextRequest) {
  try {
    const { userId } = requireAuth(request);

    const searchParams = Object.fromEntries(
      request.nextUrl.searchParams.entries(),
    );
    const query = querySchema.parse(searchParams);

    const where: Prisma.AuditLogWhereInput = { ownerId: userId };
    if (query.action) {
      where.action = query.action;
    }

    const skip = (query.page - 1) * query.limit;

    const [entries, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          actor: { select: { id: true, email: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: query.limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      entries: entries.map((e) => ({
        id: e.id,
        action: e.action,
        actor: e.actor,
        details: e.details,
        ipAddress: e.ipAddress,
        createdAt: e.createdAt,
      })),
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
