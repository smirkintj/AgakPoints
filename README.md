# AgakPoints

Gamified scrum poker for teams that ship. A host runs a session from a Jira
sprint; team members join over a link, vote on tickets in real time, and the
locked estimates sync back to Jira.

## Getting Started

```bash
npm install
cp .env.example .env.local   # then fill in the values — see "Environment" below
npm run db:migrate           # apply migrations to your local database
npm run dev:all              # Next.js on :3000 and PartyKit on :1999
```

Open [http://localhost:3000](http://localhost:3000).

`npm run dev` alone starts only Next.js. The app will load, but nothing will be
live — see "Real-time sync" below.

## Environment

Every variable in `.env.example` is required. Three of them are secrets the app
refuses to start without, because a default value would be a security hole
rather than a convenience:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string. |
| `AUTH_SECRET` | NextAuth session signing key. `openssl rand -base64 32` |
| `SECRET_KEY` | AES-256-GCM key encrypting Jira/Confluence tokens at rest. Must be 64 hex chars. |
| `PARTYKIT_SECRET` | HMAC key proving host identity to the PartyKit room. `openssl rand -hex 32` |
| `NEXT_PUBLIC_PARTYKIT_HOST` | PartyKit host, no protocol prefix. |

`PARTYKIT_SECRET` must hold the **same value** in the Next.js environment and on
PartyKit itself (`npx partykit env add PARTYKIT_SECRET`). An admin token is just
`HMAC-SHA256(sessionId)`, and session IDs travel in URLs — if the two sides
disagree the host can't control the room, and if the secret were guessable
anyone could forge host credentials for any session.

## Database migrations

Schema changes are tracked as migrations in `prisma/migrations`. `npm run build`
runs `prisma migrate deploy` before building, so deploying applies any pending
migrations.

```bash
npm run db:migrate     # create + apply a migration locally after editing schema.prisma
npm run db:generate    # regenerate the Prisma client
npm run db:studio      # browse the data
```

**Do not use `prisma db push` against a database with real data.** It force-syncs
the schema and will drop columns and tables to make the database match.

### Baselining an existing database

If your database was created with `db push` before migrations existed, it already
has the tables that `0_init` wants to create, so `migrate deploy` would fail.
Tell Prisma that migration is already applied — once, against that database:

```bash
npx prisma migrate resolve --applied 0_init
```

Then `migrate deploy` picks up from the next migration onwards. Fresh databases
need nothing; they just run `0_init` normally.

## Real-time sync (PartyKit)

Live features (check-in presence, voting, reveals) run over a WebSocket
connection to a [PartyKit](https://www.partykit.io/) server defined in
`party/index.ts`. This is a **separate process** from `next dev`.

```bash
npm run dev:all       # both, concurrently
# or, in two terminals:
npm run dev           # Next.js on :3000
npm run dev:party     # PartyKit on :1999
```

For any non-local deployment:

1. Deploy the PartyKit server: `npm run party:deploy` — this prints your room
   host, typically `<project-name>.<your-username>.partykit.dev`.
2. Set `NEXT_PUBLIC_PARTYKIT_HOST` in your deployment platform's environment
   variables (e.g. Vercel project settings) to that host, **without** a protocol
   prefix (`partysocket` adds `wss://` automatically).
3. Register `PARTYKIT_SECRET` with PartyKit: `npx partykit env add PARTYKIT_SECRET`.

If `NEXT_PUBLIC_PARTYKIT_HOST` is missing or wrong, every client silently tries
to reach its own `localhost:1999` and fails — watch for the "Disconnected" banner
at the top of the Host/Participant/Waiting Room views.

## Checks

```bash
npm run typecheck
npm run lint
npm test
```

All three run in CI (`.github/workflows/ci.yml`) on every push and pull request,
along with a production build.

## Known limitations

- **Participant identity is link-based.** Members have no accounts; anyone
  holding a session link can claim to be any member of that session, which means
  votes and role-gated actions are trusted rather than authenticated. This suits
  a team sharing a call and does not suit untrusted participants.
- **PartyKit room state is in-memory**, persisted per room via PartyKit storage.
  It is not reconciled against Postgres, so the two can drift if a room restarts
  mid-session.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev:all` | Next.js + PartyKit together |
| `npm run build` | `prisma migrate deploy` then `next build` |
| `npm test` | Vitest unit tests |
| `npm run party:deploy` | Deploy the PartyKit room server |
| `node purge.mjs` | **Destructive.** Empties all session data. Refuses non-local databases unless `PURGE_ALLOW_REMOTE=yes`, and prompts for confirmation. |
