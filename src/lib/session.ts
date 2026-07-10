import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "./types";

export const adminSessionCookie = "yardle_admin_session";
export const adminSessionDurationSeconds = 12 * 60 * 60;

const adminRoles = new Set<Role>(["super_admin", "landlord_admin", "admin"]);

export type AdminSession = {
  userId: string;
  email: string;
  role: Role;
  exp: number;
};

function getSecret() {
  return process.env.AUTH_SECRET;
}

function signPayload(payload: string) {
  const secret = getSecret();
  if (!secret) {
    throw new Error("AUTH_SECRET is required for admin authentication.");
  }
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function secureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createAdminSessionCookie(input: Omit<AdminSession, "exp">) {
  if (!adminRoles.has(input.role)) {
    throw new Error("Invalid admin role.");
  }
  const payload = Buffer.from(JSON.stringify({ ...input, exp: Date.now() + adminSessionDurationSeconds * 1000 }), "utf8").toString("base64url");
  return `${payload}.${signPayload(payload)}`;
}

export function parseAdminSession(value?: string): AdminSession | undefined {
  if (!value) return undefined;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return undefined;

  try {
    if (!secureEqual(signPayload(payload), signature)) return undefined;
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminSession;
    if (!session.userId || !session.email || !adminRoles.has(session.role) || typeof session.exp !== "number") return undefined;
    if (session.exp <= Date.now()) return undefined;
    return session;
  } catch {
    return undefined;
  }
}

export function getAdminSession() {
  return parseAdminSession(cookies().get(adminSessionCookie)?.value);
}

export async function requireAdminSession() {
  const session = getAdminSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}