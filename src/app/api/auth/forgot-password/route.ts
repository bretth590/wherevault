import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { handleError } from "@/lib/auth";

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);

    const successMessage =
      "If an account with that email exists, a password reset link has been sent";

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json({ message: successMessage });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpiry,
      },
    });

    const response: Record<string, unknown> = { message: successMessage };

    if (process.env.NODE_ENV === "development") {
      response.resetToken = resetToken;
    }

    return NextResponse.json(response);
  } catch (error) {
    return handleError(error);
  }
}
