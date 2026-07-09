import { NextResponse, type NextRequest } from "next/server";

const roleCookie = "e_state_role";

export function middleware(request: NextRequest) {
  const role = request.cookies.get(roleCookie)?.value ?? "admin";
  const path = request.nextUrl.pathname;

  if (path.startsWith("/admin") && role === "tenant") {
    return NextResponse.redirect(new URL("/tenant", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/tenant/:path*"]
};
