import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "./lib/auth";

const ADMIN_ACCESS_KEY =
  process.env.ADMIN_ACCESS_KEY || "fls-ctrl-7x9k2";

// Centralized role → dashboard mapping
const ROLE_DASHBOARD: Record<string, string> = {
  ADMIN: "/admin/dashboard",
  EDUCATOR: "/educator/dashboard",
  STUDENT: "/student/dashboard",
};

// Public routes
const PUBLIC_PATHS = [
  "/auth/role-selection",
  "/auth/educator/login",
  "/auth/educator/register",
  "/auth/student/login",
  "/auth/student/register",
  "/auth/forgot-password",
];

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  const token = request.cookies.get("auth-token")?.value;

  // Verify token once
  let user = null;
  if (token) {
    try {
      user = await verifyToken(token);
    } catch {
      user = null;
    }
  }

  const isPublicPath = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );

  const isAdminAuthPage = pathname.startsWith("/auth/admin");
  const isAdminLanding = pathname === "/admin";

  // 1. Root redirect (authenticated users)
  if (pathname === "/" && user) {
    return NextResponse.redirect(
      new URL(ROLE_DASHBOARD[user.role], request.url)
    );
  }

  // 2. Admin Access Gate
  if (isAdminAuthPage || isAdminLanding) {
    // Already authenticated admin
    if (user?.role === "ADMIN") {
      return NextResponse.redirect(
        new URL("/admin/dashboard", request.url)
      );
    }

    const accessKey = searchParams.get("access");
    const hasAccessCookie =
      request.cookies.get("admin-access")?.value === "1";

    // Valid access key
    if (accessKey === ADMIN_ACCESS_KEY) {
      const cleanUrl = request.nextUrl.clone();
      cleanUrl.searchParams.delete("access");

      const response = NextResponse.rewrite(cleanUrl);
      response.cookies.set("admin-access", "1", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 60 * 30,
        path: "/",
      });

      return response;
    }

    if (hasAccessCookie) {
      return NextResponse.next();
    }

    return NextResponse.redirect(new URL("/", request.url));
  }

  // 3. Authenticated user accessing auth pages → redirect
  if (user && isPublicPath && pathname !== "/auth/forgot-password") {
    return NextResponse.redirect(
      new URL(ROLE_DASHBOARD[user.role], request.url)
    );
  }

  // 4. Validate role query param (landing page)
  if (pathname === "/") {
    const roleParam = searchParams.get("role");

    if (roleParam && roleParam !== "student" && roleParam !== "educator") {
      return NextResponse.rewrite(
        new URL("/not-found", request.url)
      );
    }

    return NextResponse.next();
  }

  // 5. Allow public routes
  if (isPublicPath) {
    return NextResponse.next();
  }

  // 6. No token → redirect to correct login
  if (!token) {
    if (pathname.startsWith("/admin")) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (pathname.startsWith("/educator")) {
      return NextResponse.redirect(
        new URL("/auth/educator/login", request.url)
      );
    }

    if (pathname.startsWith("/student")) {
      return NextResponse.redirect(
        new URL("/auth/student/login", request.url)
      );
    }

    return NextResponse.redirect(
      new URL("/auth/role-selection", request.url)
    );
  }

  // 7. Invalid token → clear + redirect
  if (!user) {
    let redirectUrl = "/auth/role-selection";

    if (pathname.startsWith("/admin")) {
      redirectUrl = "/";
    } else if (pathname.startsWith("/educator")) {
      redirectUrl = "/auth/educator/login";
    } else if (pathname.startsWith("/student")) {
      redirectUrl = "/auth/student/login";
    }

    const response = NextResponse.redirect(
      new URL(redirectUrl, request.url)
    );

    response.cookies.set("auth-token", "", { maxAge: 0 });

    return response;
  }
 
  // 8. Role-based route protection
  if (pathname.startsWith("/admin") && user.role !== "ADMIN") {
    return NextResponse.redirect(
      new URL(ROLE_DASHBOARD[user.role], request.url)
    );
  }

  if (pathname.startsWith("/educator") && user.role !== "EDUCATOR") {
    return NextResponse.redirect(
      new URL(ROLE_DASHBOARD[user.role], request.url)
    );
  }

  if (pathname.startsWith("/student") && user.role !== "STUDENT") {
    return NextResponse.redirect(
      new URL(ROLE_DASHBOARD[user.role], request.url)
    );
  }

  // 9. Allow request
  return NextResponse.next();
}

// Middleware Matcher
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|pdf|js|css|mjs)$).*)",
  ],
};