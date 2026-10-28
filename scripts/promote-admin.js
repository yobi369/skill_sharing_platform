import pg from "pg";

const { Pool } = pg;
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
if (!process.env.DATABASE_URL || !email || process.env.CONFIRM_ADMIN_PROMOTION !== "true") {
  console.error("Set DATABASE_URL, ADMIN_EMAIL, and CONFIRM_ADMIN_PROMOTION=true to promote one verified account.");
  process.exit(1);
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  connectionTimeoutMillis: 5000
});
try {
  const result = await pool.query(
    "UPDATE users SET role = 'admin', updated_at = now() WHERE email = $1 AND email_verified = true AND status = 'active' RETURNING id, email, role",
    [email]
  );
  if (!result.rowCount) {
    console.error("No active, email-verified account matched ADMIN_EMAIL. Create the account and verify its email first.");
    process.exitCode = 1;
  } else {
    console.log("Admin role granted:", result.rows[0].email, "(", result.rows[0].id, ")");
  }
} catch (error) {
  console.error("Admin promotion failed:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
