import { neon } from '@neondatabase/serverless';
import { createInterface } from 'node:readline/promises';

// Destructive: empties every session-related table. Guarded because the only
// thing separating a local reset from wiping production is which DATABASE_URL
// happens to be exported in the shell.

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

let host;
try {
  host = new URL(url).host;
} catch {
  console.error('DATABASE_URL is not a parseable URL.');
  process.exit(1);
}

const looksLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host);
if (!looksLocal && process.env.PURGE_ALLOW_REMOTE !== 'yes') {
  console.error(
    `Refusing to purge a non-local database (${host}).\n` +
      'If you really mean it, re-run with PURGE_ALLOW_REMOTE=yes.'
  );
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question(
  `This deletes ALL sessions, tickets, votes, holidays and achievements from ${host}.\n` +
    `Type the host name to confirm: `
);
rl.close();

if (answer.trim() !== host) {
  console.error('Confirmation did not match. Nothing was deleted.');
  process.exit(1);
}

const sql = neon(url);

try {
  // Ordered so child rows go before the rows they reference.
  await sql`DELETE FROM "Achievement"`;
  console.log('achievements deleted');
  await sql`DELETE FROM "Vote"`;
  console.log('votes deleted');
  await sql`DELETE FROM "SprintHoliday"`;
  console.log('holidays deleted');
  await sql`DELETE FROM "SprintLeave"`;
  console.log('leaves deleted');
  await sql`DELETE FROM "SessionParticipant"`;
  console.log('participants deleted');
  await sql`DELETE FROM "Ticket"`;
  console.log('tickets deleted');
  await sql`DELETE FROM "PokerSession"`;
  console.log('sessions deleted');
  console.log('All done.');
} catch (e) {
  console.error('Error:', e?.message ?? e);
  process.exitCode = 1;
}
