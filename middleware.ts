import { NextResponse, type NextRequest } from "next/server";

const sessionCookie = "yardle_admin_session";
const protectedPrefixes = ["/admin", "/readings", "/units", "/billing", "/bills", "/payments", "/reports", "/sms", "/settings"];
const adminRoles = new Set(["super_admin", "landlord_admin", "admin"]);

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

async function signPayload(payload: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return undefined;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const bytes = Array.from(new Uint8Array(signature));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function validAdminSession(value?: string) {
  if (!value) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;

  try {
    const expected = await signPayload(payload);
    if (!expected || expected !== signature) return false;
    const session = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload))) as { exp?: number; role?: string; email?: string; userId?: string };
    return Boolean(session.userId && session.email && session.role && adminRoles.has(session.role) && typeof session.exp === "number" && session.exp > Date.now());
  } catch {
    return false;
  }
}

function isProtected(pathname: string) {
  return pathname === "/" || protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const authenticated = await validAdminSession(request.cookies.get(sessionCookie)?.value);

  if (pathname === "/") {
    return NextResponse.redirect(new URL(authenticated ? "/admin" : "/login", request.url));
  }

  if (pathname === "/login") {
    return authenticated ? NextResponse.redirect(new URL("/admin", request.url)) : NextResponse.next();
  }

  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

  if (authenticated) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/", "/login", "/admin/:path*", "/readings/:path*", "/units/:path*", "/billing/:path*", "/bills/:path*", "/payments/:path*", "/reports/:path*", "/sms/:path*", "/settings/:path*"]
};