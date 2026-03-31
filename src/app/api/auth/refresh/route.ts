import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  handleError,
  signToken,
  setAuthCookies,
  clearAuthCookies,
  generateRefreshToken,
  createRefreshTokenRecord,
  hashToken,
  revokeRefreshToken,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const oldRawToken = request.cookies.get("refresh_token")?.value;
    if (!oldRawToken) {
      return NextResponse.json({ error: "No refresh token" }, { status: 401 });
    }

    const oldHash = hashToken(oldRawToken);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: oldHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      // Token reuse detection: if token was already revoked, revoke all user tokens
      if (stored?.revokedAt) {
        await prisma.refreshToken.updateMany({
          where: { userId: stored.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      const response = NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
      clearAuthCookies(response);
      return response;
    }

    // Revoke old token
    await revokeRefreshToken(oldRawToken);

    // Load user for new access token
    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) {
      const response = NextResponse.json({ error: "User not found" }, { status: 401 });
      clearAuthCookies(response);
      return response;
    }

    const edek = user.serverEncryptedDek || undefined;
    const accessToken = signToken({ userId: user.id, email: user.email, edek });
    const newRefreshToken = generateRefreshToken();
    await createRefreshTokenRecord(user.id, newRefreshToken);

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
      },
    });

    setAuthCookies(response, accessToken, newRefreshToken);
    return response;
  } catch (error) {
    return handleError(error);
  }
}
