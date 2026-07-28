"use client";
import { useEffect, useRef, type RefObject } from "react";

/**
 * Keep a ref pointing at the newest value without reading or writing it during
 * render — the "latest ref" pattern.
 *
 * Useful for long-lived subscriptions (a WebSocket, an interval) that must call
 * the current version of a callback but shouldn't be torn down and rebuilt every
 * time that callback's identity changes. Assigning `ref.current = value` straight
 * in the component body does the same job but makes render impure, which React
 * flags; doing it in an effect that runs after every render does not.
 */
export function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
