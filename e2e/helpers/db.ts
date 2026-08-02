import crypto from "node:crypto";
import postgres from "postgres";
import { DATABASE_URL } from "./config";

let sql: ReturnType<typeof postgres> | null = null;

function db() {
  if (!DATABASE_URL)
    throw new Error("DATABASE_URL is not set; cannot touch the database");
  if (!sql) sql = postgres(DATABASE_URL, { max: 1 });
  return sql;
}

export async function closeDb(): Promise<void> {
  if (sql) {
    await sql.end();
    sql = null;
  }
}

export async function userIdByUsername(username: string): Promise<string> {
  const rows =
    await db()`SELECT id FROM auth.users WHERE username = ${username} LIMIT 1`;
  if (rows.length === 0)
    throw new Error(`user ${username} not found in auth.users`);
  const row = rows[0];
  if (!row) throw new Error(`user ${username} not found in auth.users`);
  return String(row.id);
}

export async function createResetToken(username: string): Promise<string> {
  const userId = await userIdByUsername(username);
  const token = crypto.randomBytes(64).toString("hex");
  await db()`
    INSERT INTO auth.password_resets (id, user_id, token, expires_at)
    VALUES (${crypto.randomUUID()}, ${userId}, ${token}, ${new Date(Date.now() + 60 * 60 * 1000)})
  `;
  return token;
}

export async function resetIsUsed(token: string): Promise<boolean> {
  const rows =
    await db()`SELECT used FROM auth.password_resets WHERE token = ${token}`;
  return rows[0]?.used === true;
}
