import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleError, clearAuthCookies } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request);

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    return handleError(error);
  }
}

const deleteAccountSchema = z.object({
  password: z.string().min(1, "Password is required to delete your account"),
});

export async function DELETE(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    const body = await request.json();
    const { password } = deleteAccountSchema.parse(body);

    const user = await prisma.user.findUnique({ where: { id: auth.userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Password is incorrect" }, { status: 401 });
    }

    // Cascade delete handles all related data
    await prisma.user.delete({ where: { id: auth.userId } });

    const response = NextResponse.json({ message: "Account deleted successfully" });
    clearAuthCookies(response);
    return response;
  } catch (error) {
    return handleError(error);
  }
}
