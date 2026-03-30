import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { handleError, signToken } from "@/lib/auth";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(12, "Password must be at least 12 characters"),
  name: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = registerSchema.parse(body);

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const emailVerifyToken = crypto.randomBytes(32).toString("hex");

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash: hashedPassword,
        name: name || null,
        emailVerifyToken,
      },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    const token = signToken({ userId: user.id, email: user.email });

    const response: Record<string, unknown> = { token, user };

    if (process.env.NODE_ENV === "development") {
      response.emailVerifyToken = emailVerifyToken;
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
