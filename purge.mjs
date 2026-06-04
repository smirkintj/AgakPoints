import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

try {
  await sql`DELETE FROM "Achievement"`;
  console.log('achievements deleted');
  await sql`DELETE FROM "Vote"`;
  console.log('votes deleted');
  await sql`DELETE FROM "SprintHoliday"`;
  console.log('holidays deleted');
  await sql`DELETE FROM "SessionLeave"`;
  console.log('leaves deleted');
  await sql`DELETE FROM "SessionParticipant"`;
  console.log('participants deleted');
  await sql`DELETE FROM "Ticket"`;
  console.log('tickets deleted');
  await sql`DELETE FROM "PokerSession"`;
  console.log('sessions deleted');
  console.log('All done.');
} catch(e) {
  console.error('Error:', e?.message ?? e);
}
