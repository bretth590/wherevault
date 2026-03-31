import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { handleError, checkRateLimit } from "@/lib/auth";
import {
  generateSalt,
  deriveKeyFromPassword,
  wrapDekWithKey,
  unwrapDekFromServerKek,
} from "@/lib/crypto";

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(12, "Password must be at least 12 characters"),
});

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(`auth:${ip}`, 10, 60_000)) {
      return NextResponse.json(
        { error: "Too many attempts, please try again later" },
        { status: 429 },
      );
    }

    const body = await request.json();
    const { token, password } = resetPasswordSchema.parse(body);

    const user = await prisma.user.findFirst({
      where: { passwordResetToken: token },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired reset token" },
        { status: 400 },
      );
    }

    if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      return NextResponse.json(
        { error: "Reset token has expired" },
        { status: 400 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Re-wrap DEK with new password-derived key
    const updateData: Record<string, unknown> = {
      passwordHash: hashedPassword,
      passwordResetToken: null,
      passwordResetExpires: null,
    };

    if (user.serverEncryptedDek) {
      const salt = user.dekSalt
        ? Buffer.from(user.dekSalt, "base64")
        : generateSalt();
      const uek = await deriveKeyFromPassword(password, salt);
      const dek = unwrapDekFromServerKek(user.serverEncryptedDek);
      updateData.encryptedDek = wrapDekWithKey(dek, uek);
      updateData.dekSalt = salt.toString("base64");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    // Revoke all existing refresh tokens on password reset
    await prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({ message: "Password reset successfully" });
  } catch (error) {
    return handleError(error);
  }
}
