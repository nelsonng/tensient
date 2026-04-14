import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';
const env = readFileSync('.env.local','utf8');
const match = env.match(/^DATABASE_URL=(.*)$/m);
const sql = neon(match[1]);
try {
  await sql.unsafe('create table if not exists __tmp_migration_probe(id int)');
  const rows = await sql`select to_regclass('public.__tmp_migration_probe') as t`;
  console.log(rows);
  await sql.unsafe('drop table if exists __tmp_migration_probe');
} catch (e) {
  console.error('ERR', e.message);
  process.exit(1);
}
