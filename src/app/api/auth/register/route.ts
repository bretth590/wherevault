import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
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
  generateDek,
  deriveKeyFromPassword,
  wrapDekWithKey,
  wrapDekWithServerKek,
} from "@/lib/crypto";
import { sendVerificationEmail } from "@/lib/email";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(12, "Password must be at least 12 characters"),
  name: z.string().optional(),
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
    const { email, password, name } = registerSchema.parse(body);

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const emailVerifyToken = crypto.randomBytes(32).toString("hex");

    // Per-user encryption: derive UEK from password, generate DEK, wrap DEK
    const salt = generateSalt();
    const uek = await deriveKeyFromPassword(password, salt);
    const dek = generateDek();
    const encryptedDek = wrapDekWithKey(dek, uek);
    const serverEncryptedDek = wrapDekWithServerKek(dek);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash: hashedPassword,
        name: name || null,
        emailVerifyToken,
        encryptedDek,
        serverEncryptedDek,
        dekSalt: salt.toString("base64"),
        dekVersion: 1,
      },
    });

    const accessToken = signToken({ userId: user.id, email: user.email, edek: serverEncryptedDek });
    const refreshToken = generateRefreshToken();
    await createRefreshTokenRecord(user.id, refreshToken);

    await sendVerificationEmail(user.email, emailVerifyToken);

    const responseData: Record<string, unknown> = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
    };

    if (process.env.NODE_ENV === "development") {
      responseData.emailVerifyToken = emailVerifyToken;
    }

    const response = NextResponse.json(responseData, { status: 201 });
    setAuthCookies(response, accessToken, refreshToken);
    return response;
  } catch (error) {
    return handleError(error);
  }
}
