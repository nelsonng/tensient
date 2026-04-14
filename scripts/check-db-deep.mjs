import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.local', 'utf8');
const match = env.match(/^DATABASE_URL=(.*)$/m);
if (!match) throw new Error('DATABASE_URL missing');
const sql = neon(match[1]);

const db = await sql`select current_database() as db, current_user as user, current_schema() as schema`;
const mig = await sql`select table_name from information_schema.tables where table_schema='public' and table_name in ('tasks','feedback_submissions','__drizzle_migrations') order by table_name`;
const cols = await sql`select table_name,column_name from information_schema.columns where table_schema='public' and table_name in ('feedback_submissions','tasks') and column_name='archived_at'`;
console.log(JSON.stringify({db:db[0],tables:mig,cols}, null, 2));
