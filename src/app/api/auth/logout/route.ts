import { NextRequest, NextResponse } from "next/server";
import { handleError, clearAuthCookies, revokeRefreshToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const rawToken = request.cookies.get("refresh_token")?.value;
    if (rawToken) {
      await revokeRefreshToken(rawToken);
    }

    const response = NextResponse.json({ message: "Logged out" });
    clearAuthCookies(response);
    return response;
  } catch (error) {
    return handleError(error);
  }
}
