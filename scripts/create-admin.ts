import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import bcrypt from "bcryptjs";
import { closePool, query } from "../src/lib/db";
import { loadLocalEnv } from "./env";

const roles = new Set(["super_admin", "landlord_admin", "admin"]);

function isDuplicateEmailError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "ER_DUP_ENTRY"
  );
}

async function main() {
  loadLocalEnv();
  const rl = createInterface({ input, output });

  try {
    const name = (await rl.question("Name: ")).trim();
    const email = (await rl.question("Email: ")).trim().toLowerCase();
    const password = await rl.question("Password: ");
    const roleInput = (await rl.question("Role (super_admin/admin/landlord_admin): ")).trim() || "super_admin";

    if (!name || !email || !password) {
      throw new Error("Name, email and password are required.");
    }
    if (!roles.has(roleInput)) {
      throw new Error("Role must be super_admin, landlord_admin or admin.");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await query(
      `insert into users (id, name, email, role, password_hash, created_at)
       values (?, ?, ?, ?, ?, utc_timestamp())`,
      [randomUUID(), name, email, roleInput, passwordHash]
    );
    console.log(`Admin user ready: ${email}`);
  } catch (error) {
    if (isDuplicateEmailError(error)) {
      throw new Error("An admin user with that email address already exists.");
    }
    throw error;
  } finally {
    rl.close();
    await closePool();
  }
}

main().catch((error) => {
  console.error("Failed to create admin:", error);
  process.exit(1);
});