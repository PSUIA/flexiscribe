import { clearAuthCookie, getCurrentUser } from "@/src/lib/auth";
import { NextResponse } from "next/server";
import prisma from "@/src/lib/db";

export async function POST() {
  try {
    // Get user first so we can clear their DB token (if any) and return role for client redirect.
    const user = await getCurrentUser();
    const role = user?.role || null;

    if (user) {
      try {
        await prisma.user.update({
          where: { id: user.userId },
          data: { token: null, tokenExpiry: null },
        });
      } catch (dbError) {
        console.error("Failed to clear DB token:", dbError);
      }
    }

    // Clear the authentication cookie
    await clearAuthCookie();

    return NextResponse.json(
      { message: "Logout successful", role },
      { status: 200 }
    );
  } catch (error) {
    console.error("Logout error:", error);

    // Try to clear token even on error
    try {
      await clearAuthCookie();
    } catch (_) {
      // Best effort
    }

    return NextResponse.json(
      { error: "An error occurred during logout" },
      { status: 500 }
    );
  }
}
