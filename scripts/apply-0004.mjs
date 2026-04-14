import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.local', 'utf8');
const match = env.match(/^DATABASE_URL=(.*)$/m);
if (!match) throw new Error('DATABASE_URL missing');
const sql = neon(match[1]);

const migration = readFileSync('drizzle/0004_tasks_and_feedback_archive.sql', 'utf8');
const statements = migration
  .split('--> statement-breakpoint')
  .map((s) => s.trim())
  .filter(Boolean);

for (const statement of statements) {
  try {
    await sql.unsafe(statement);
  } catch (error) {
    const message = String(error?.message || error);
    const ignorable = [
      'already exists',
      'duplicate key value',
      'column "archived_at" of relation "feedback_submissions" already exists',
    ].some((needle) => message.toLowerCase().includes(needle));

    if (!ignorable) {
      console.error('Failed statement:\n', statement);
      throw error;
    }
  }
}

console.log('Migration 0004 applied (or already present).');
