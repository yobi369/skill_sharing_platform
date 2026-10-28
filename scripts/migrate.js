import pg from "pg";
import { readFile } from "node:fs/promises";

const { Pool } = pg;
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required to run migrations.");
  process.exit(1);
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined
});
let client;
try {
  client = await pool.connect();
  const sql = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.log("Database schema applied successfully.");
} catch (error) {
  if (client) await client.query("ROLLBACK").catch(() => {});
  console.error("Database migration failed:", error.message);
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
