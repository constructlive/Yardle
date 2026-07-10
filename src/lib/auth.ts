import { getAppData } from "./data";
import type { Role, User } from "./types";

export async function getDemoUser(role: Role = "admin"): Promise<User> {
  const { users } = await getAppData();
  return users.find((user) => user.role === role) ?? users[0];
}

export function canAccessAdmin(role: Role): boolean {
  return role === "super_admin" || role === "landlord_admin" || role === "admin";
}

export function canAccessTenant(role: Role): boolean {
  return role === "tenant";
}
