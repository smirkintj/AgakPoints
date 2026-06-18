"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import PartySocket from "partysocket";
import type { MsgIn, MsgOut } from "@/types/partykit";

const PARTYKIT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999";

export type PartyConnectionStatus = "connecting" | "open" | "disconnected";

export function usePartyRoom(
  sessionId: string,
  onMessage: (msg: MsgOut) => void,
  onOpen?: () => void,
  getAdminToken?: () => string | null
) {
  const socketRef = useRef<PartySocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const getAdminTokenRef = useRef(getAdminToken);
  getAdminTokenRef.current = getAdminToken;
  const [status, setStatus] = useState<PartyConnectionStatus>("connecting");

  useEffect(() => {
    const socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: sessionId,
    });

    socket.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data as string) as MsgOut;
        if (msg.type === "STATE_SYNC" && msg.state.serverVersion) {
          console.log(`[PartyKit] server version: ${msg.state.serverVersion}`);
        }
        onMessageRef.current(msg);
      } catch {
        // ignore malformed
      }
    });

    // Request full state sync on connect (handles reconnects too)
    socket.addEventListener("open", () => {
      setStatus("open");
      socket.send(JSON.stringify({ type: "REQUEST_STATE" } satisfies MsgIn));
      onOpenRef.current?.();
    });

    socket.addEventListener("close", () => {
      setStatus("disconnected");
    });

    socket.addEventListener("error", (event) => {
      console.error("[PartyKit] WebSocket error:", event);
      setStatus("disconnected");
    });

    socketRef.current = socket;
    return () => socket.close();
  }, [sessionId]);

  const send = useCallback((msg: MsgIn) => {
    const token = getAdminTokenRef.current?.();
    const payload = token ? { ...msg, adminToken: token } : msg;
    socketRef.current?.send(JSON.stringify(payload));
  }, []);

  return { send, status };
}
