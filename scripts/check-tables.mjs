import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env manually without requiring dotenv
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

const url = process.env.SUPABASE_URL || "https://gnmbmwplrjwkslvtcghr.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!key) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(url, key);

async function check() {
  console.log(`Connecting to ${url} ...`);
  const tables = [
    "profiles",
    "departments",
    "venues",
    "bookings",
    "user_roles",
    "approvals",
    "notifications",
    "audit_logs",
  ];

  let allOk = true;

  for (const table of tables) {
    const { error } = await supabase.from(table).select("*").limit(1);
    if (error) {
      console.log(`❌ Table '${table}': NOT FOUND / ERROR -> ${error.message}`);
      allOk = false;
    } else {
      console.log(`✅ Table '${table}': READY`);
    }
  }

  // Check storage bucket
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  if (bErr) {
    console.log(`❌ Storage buckets check error: ${bErr.message}`);
  } else {
    const hasBucket = (buckets || []).some((b) => b.name === "venue-photos");
    console.log(
      hasBucket
        ? "✅ Storage bucket 'venue-photos': READY"
        : "❌ Storage bucket 'venue-photos': MISSING",
    );
  }

  if (allOk) {
    console.log("\n🎉 All auditorium booking tables and storage are fully set up and ready!");
  } else {
    console.log(
      "\n⚠️ Tables need to be created. Please execute supabase_setup_auditorium.sql in the Supabase SQL Editor.",
    );
  }
}

check();
