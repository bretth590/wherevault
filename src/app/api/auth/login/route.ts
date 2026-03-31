import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  handleError,
  signToken,
  setAuthCookies,
  generateRefreshToken,
  createRefreshTokenRecord,
  checkRateLimit,
} from "@/lib/auth";
import {
  generateSalt,
  deriveKeyFromPassword,
  wrapDekWithKey,
  unwrapDekFromServerKek,
} from "@/lib/crypto";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(`auth:${ip}`, 10, 60_000)) {
      return NextResponse.json(
        { error: "Too many authentication attempts, please try again later" },
        { status: 429 },
      );
    }

    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    let edek: string | undefined;
    if (user.serverEncryptedDek) {
      edek = user.serverEncryptedDek;

      // Lazy migration: create password-derived wrapping for users who only have server-wrapped DEK
      if (!user.encryptedDek) {
        const salt = user.dekSalt
          ? Buffer.from(user.dekSalt, "base64")
          : generateSalt();
        const uek = await deriveKeyFromPassword(password, salt);
        const dek = unwrapDekFromServerKek(user.serverEncryptedDek);
        const encryptedDek = wrapDekWithKey(dek, uek);
        await prisma.user.update({
          where: { id: user.id },
          data: {
            encryptedDek,
            dekSalt: salt.toString("base64"),
            dekVersion: user.dekVersion || 1,
          },
        });
      }
    }

    const accessToken = signToken({ userId: user.id, email: user.email, edek });
    const refreshToken = generateRefreshToken();
    await createRefreshTokenRecord(user.id, refreshToken);

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
    });

    setAuthCookies(response, accessToken, refreshToken);
    return response;
  } catch (error) {
    return handleError(error);
  }
}
