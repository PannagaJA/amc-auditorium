import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlPath = path.resolve(__dirname, "../supabase_setup_auditorium.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

const password = process.env.DB_PASSWORD || process.argv[2];
const pat = process.env.SUPABASE_ACCESS_TOKEN || process.argv[3];
const projectId = process.env.SUPABASE_PROJECT_ID || "xbphtykapriescuxresb";

async function runWithPg(dbPassword) {
  const connectionString = `postgresql://postgres.${projectId}:${encodeURIComponent(dbPassword)}@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`;
  console.log("Connecting via pooler to project", projectId, "...");

  let client;
  try {
    client = new pg.Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    console.log("Connected successfully! Running SQL migration...");
    await client.query(sql);
    console.log("✅ Migration applied successfully via postgres pooler!");
    await client.end();
    return true;
  } catch (err) {
    console.log("Pooler connection failed, trying direct connection on port 5432...");
    try {
      const directUri = `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${projectId}.supabase.co:5432/postgres`;
      client = new pg.Client({
        connectionString: directUri,
        ssl: { rejectUnauthorized: false },
      });
      await client.connect();
      console.log("Connected direct! Running SQL migration...");
      await client.query(sql);
      console.log("✅ Migration applied successfully via direct connection!");
      await client.end();
      return true;
    } catch (err2) {
      console.error("❌ Failed to run migration via pg:", err2.message);
      if (client) await client.end().catch(() => {});
      return false;
    }
  }
}

async function runWithPAT(token) {
  console.log("Executing SQL migration via Supabase Management API...");
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error("❌ Management API error:", res.status, txt);
      return false;
    }
    console.log("✅ Migration applied successfully via Supabase Management API!");
    return true;
  } catch (err) {
    console.error("❌ Network error with Management API:", err.message);
    return false;
  }
}

async function main() {
  if (pat) {
    const ok = await runWithPAT(pat);
    if (ok) process.exit(0);
  }
  if (password) {
    const ok = await runWithPg(password);
    if (ok) process.exit(0);
    process.exit(1);
  }
  console.log("Usage: node scripts/apply-migration.mjs <DB_PASSWORD> [SUPABASE_ACCESS_TOKEN]");
  console.log(
    "Or run the SQL file supabase_setup_auditorium.sql directly in Supabase Dashboard SQL Editor.",
  );
}

main();
