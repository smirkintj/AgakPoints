"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, WifiOff } from "lucide-react";
import type { PartyConnectionStatus } from "@/hooks/usePartyRoom";

export function ConnectionStatusBanner({ status }: { status: PartyConnectionStatus }) {
  return (
    <AnimatePresence>
      {status !== "open" && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-sm"
          style={
            status === "connecting"
              ? { borderColor: "rgba(245,158,11,0.4)", backgroundColor: "rgba(245,158,11,0.15)", color: "#fbbf24" }
              : { borderColor: "rgba(239,68,68,0.4)", backgroundColor: "rgba(239,68,68,0.15)", color: "#f87171" }
          }
        >
          {status === "connecting" ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Connecting to live session…
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5" />
              Disconnected — live updates paused, reconnecting…
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
