import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.local', 'utf8');
const match = env.match(/^DATABASE_URL=(.*)$/m);
if (!match) throw new Error('DATABASE_URL missing');

const sql = neon(match[1]);
const cols = await sql`select column_name from information_schema.columns where table_name='feedback_submissions' and column_name='archived_at'`;
const tasks = await sql`select to_regclass('public.tasks') as tasks_table`;
console.log(JSON.stringify({ archivedCol: cols.length > 0, tasksTable: tasks[0]?.tasks_table ?? null }, null, 2));
