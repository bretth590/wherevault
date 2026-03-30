import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleError } from "@/lib/auth";

const updateProfileSchema = z.object({
  name: z.string().optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const auth = requireAuth(request);

    const body = await request.json();
    const { name } = updateProfileSchema.parse(body);

    const user = await prisma.user.update({
      where: { id: auth.userId },
      data: { name: name || null },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    return handleError(error);
  }
}
