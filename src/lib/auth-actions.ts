"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasDatabaseUrl, query } from "./db";
import { adminSessionCookie, adminSessionDurationSeconds, createAdminSessionCookie } from "./session";
import type { Role } from "./types";

const adminRoles = new Set<Role>(["super_admin", "landlord_admin", "admin"]);

type UserRow = {
  id: string;
  email: string;
  role: Role;
  password_hash: string | null;
};

function safeDestination(value: FormDataEntryValue | null) {
  const destination = String(value ?? "/admin");
  if (destination === "/") return "/admin";
  return destination.startsWith("/") && !destination.startsWith("//") && destination !== "/login" ? destination : "/admin";
}

function loginRedirect(error: string, destination: string): never {
  redirect(`/login?${new URLSearchParams({ error, next: destination })}`);
}

export async function loginAdmin(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const destination = safeDestination(formData.get("next"));

  if (!process.env.AUTH_SECRET) {
    loginRedirect("config", destination);
  }
  if (!hasDatabaseUrl()) {
    loginRedirect("config", destination);
  }
  if (!email || !password) {
    loginRedirect("invalid", destination);
  }

  const result = await query<UserRow>(
    "select id, email, role, password_hash from users where lower(email) = ? limit 1",
    [email]
  );
  const user = result.rows[0];
  if (!user?.password_hash || !adminRoles.has(user.role)) {
    loginRedirect("invalid", destination);
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    loginRedirect("invalid", destination);
  }

  const sessionValue = createAdminSessionCookie({ userId: user.id, email: user.email.toLowerCase(), role: user.role });
  cookies().set(adminSessionCookie, sessionValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: adminSessionDurationSeconds
  });

  redirect(destination);
}

export async function logoutAdmin() {
  cookies().set(adminSessionCookie, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  redirect("/login");
}