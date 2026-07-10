import { readFileSync } from "node:fs";
import mysql, { type Connection } from "mysql2/promise";
import { loadLocalEnv } from "./env";

function getConfig() {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ""),
      charset: "utf8mb4_unicode_ci",
      timezone: "Z",
      multipleStatements: true
    };
  }

  if (!process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_USER) {
    throw new Error("Set DATABASE_URL or DB_HOST, DB_NAME and DB_USER before running db:setup.");
  }

  return {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: "utf8mb4_unicode_ci",
    timezone: "Z",
    multipleStatements: true
  };
}

async function main() {
  loadLocalEnv();
  let connection: Connection | undefined;

  try {
    const sql = readFileSync("database/mariadb-schema.sql", "utf8");
    connection = await mysql.createConnection(getConfig());
    await connection.query(sql);
    console.log("MariaDB schema applied.");
  } finally {
    await connection?.end();
  }
}

main().catch((error) => {
  console.error("Failed to apply MariaDB schema:", error);
  process.exit(1);
});