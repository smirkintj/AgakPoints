import Ably from "ably";

// Server-side Ably client for publishing
let _rest: Ably.Rest | null = null;

export function getAblyRest(): Ably.Rest {
  if (!_rest) {
    _rest = new Ably.Rest({ key: process.env.ABLY_API_KEY! });
  }
  return _rest;
}

export function sessionChannel(sessionId: string) {
  return `session:${sessionId}`;
}

export async function publish(sessionId: string, data: object) {
  const ably = getAblyRest();
  const channel = ably.channels.get(sessionChannel(sessionId));
  await channel.publish("event", data);
}
