"use client";
import { useEffect, useRef } from "react";
import Ably from "ably";
import type { SessionEvent } from "@/types/ably";

export function useSessionChannel(
  sessionId: string,
  onEvent: (event: SessionEvent) => void
) {
  const clientRef = useRef<Ably.Realtime | null>(null);

  useEffect(() => {
    const client = new Ably.Realtime({
      authUrl: "/api/ably-token",
      authMethod: "GET",
    });
    clientRef.current = client;

    const channel = client.channels.get(`session:${sessionId}`);
    channel.subscribe("event", (msg) => {
      onEvent(msg.data as SessionEvent);
    });

    return () => {
      channel.unsubscribe();
      client.close();
    };
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps
}
