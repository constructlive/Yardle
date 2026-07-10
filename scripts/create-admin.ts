import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import bcrypt from "bcryptjs";
import { query } from "../src/lib/db";
import { loadLocalEnv } from "./env";

loadLocalEnv();

const roles = new Set(["super_admin", "landlord_admin", "admin"]);
const rl = createInterface({ input, output });
try {
  const name = (await rl.question("Name: ")).trim();
  const email = (await rl.question("Email: ")).trim().toLowerCase();
  const password = await rl.question("Password: ");
  const roleInput = (await rl.question("Role (super_admin/admin/landlord_admin): ")).trim() || "super_admin";
  if (!name || !email || !password) throw new Error("Name, email and password are required.");
  if (!roles.has(roleInput)) throw new Error("Role must be super_admin, landlord_admin or admin.");

  const passwordHash = await bcrypt.hash(password, 12);
  await query(
    `insert into users (id, name, email, role, password_hash, created_at)
     values (?, ?, ?, ?, ?, utc_timestamp())
     on duplicate key update name=values(name), role=values(role), password_hash=values(password_hash)`,
    [randomUUID(), name, email, roleInput, passwordHash]
  );
  console.log(`Admin user ready: ${email}`);
} finally {
  rl.close();
}