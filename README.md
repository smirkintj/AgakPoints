This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Real-time sync (PartyKit)

Live features (check-in presence, voting, reveals) run over a WebSocket connection
to a [PartyKit](https://www.partykit.io/) server defined in `party/index.ts`. This
is a **separate process** from `next dev` — the app will load fine without it, but
nothing will be "live" and the UI won't show an error unless the connection-status
banner is visible.

Run both together locally:

```bash
npm run dev:all       # runs `next dev` and `partykit dev` concurrently
```

or in two terminals:

```bash
npm run dev           # Next.js on :3000
npm run dev:party     # PartyKit on :1999
```

`NEXT_PUBLIC_PARTYKIT_HOST` defaults to `localhost:1999` for local dev (see
`.env.example`). For any non-local deployment you must set it explicitly:

1. Deploy the PartyKit server: `npm run party:deploy` — this prints your room
   host, typically `<project-name>.<your-username>.partykit.dev`.
2. Set `NEXT_PUBLIC_PARTYKIT_HOST` in your deployment platform's environment
   variables (e.g. Vercel project settings) to that host, **without** a
   protocol prefix (`partysocket` adds `wss://` automatically).
3. Set the matching `PARTYKIT_SECRET` value in both the Next.js deployment env
   and on PartyKit itself (`npx partykit env add PARTYKIT_SECRET`) — it's used
   to verify admin tokens between the two services.

If `NEXT_PUBLIC_PARTYKIT_HOST` is missing or wrong, every client will silently
try to reach its own `localhost:1999` and fail — watch for the "Disconnected"
banner at the top of the Host/Participant/Waiting Room views, which now surfaces
this instead of failing silently.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
