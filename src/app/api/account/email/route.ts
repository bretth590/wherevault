import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAuth, handleError } from "@/lib/auth";

const changeEmailSchema = z.object({
  newEmail: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function PATCH(request: NextRequest) {
  try {
    const auth = requireAuth(request);

    const body = await request.json();
    const { newEmail, password } = changeEmailSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Password is incorrect" },
        { status: 401 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: newEmail.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: auth.userId },
      data: {
        email: newEmail.toLowerCase(),
        emailVerified: false,
      },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    return handleError(error);
  }
}
