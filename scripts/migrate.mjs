import { neon } from "@neondatabase/serverless";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const drizzleDir = join(__dirname, "../drizzle");

const sql = neon(process.env.DATABASE_URL);

// Get all SQL files sorted
const files = readdirSync(drizzleDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

// Check which migrations have already been applied
let applied = new Set();
try {
  const rows = await sql`SELECT id FROM __drizzle_migrations`;
  applied = new Set(rows.map((r) => r.id));
  console.log(`Already applied: ${applied.size} migrations`);
} catch {
  console.log("No migrations table yet, starting fresh");
}

for (const file of files) {
  const tag = file.replace(".sql", "");
  if (applied.has(tag)) {
    console.log(`  skip: ${file}`);
    continue;
  }

  console.log(`  apply: ${file}`);
  const content = readFileSync(join(drizzleDir, file), "utf8");

  // Split on --> statement-breakpoint
  const statements = content
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await sql.unsafe(statement);
  }

  // Record migration (if the table exists)
  try {
    await sql`INSERT INTO __drizzle_migrations (id, hash, created_at) VALUES (${tag}, ${tag}, now()) ON CONFLICT DO NOTHING`;
  } catch {
    // migrations table may not exist in older drizzle setups
  }
  console.log(`  done: ${file}`);
}

console.log("All migrations complete.");
