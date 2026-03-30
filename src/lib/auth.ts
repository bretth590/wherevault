import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export interface AuthPayload {
  userId: string;
  email: string;
}

export function getAuth(request: NextRequest): AuthPayload | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const token = header.slice(7);
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
  } catch {
    return null;
  }
}

export function requireAuth(request: NextRequest): AuthPayload {
  const user = getAuth(request);
  if (!user) throw new AuthError();
  return user;
}

export class AuthError extends Error {
  constructor() {
    super("Unauthorized");
  }
}

export function handleError(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: "Missing or invalid authorization" }, { status: 401 });
  }
  if (err instanceof Error && err.name === "ZodError") {
    return NextResponse.json({ error: "Validation error", details: (err as any).errors }, { status: 400 });
  }
  console.error("Unhandled error:", err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as string & jwt.SignOptions["expiresIn"],
  });
}
