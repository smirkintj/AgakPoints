"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, FileText, ChevronDown, ChevronRight, Square } from "lucide-react";

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtDate(d: Date) { return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`; }

type Session = {
  id: string;
  name?: string | null;
  sprintName: string;
  createdAt: Date;
  status: string;
  _count: { tickets: number };
};

function SessionRow({ s, productId, onEnd }: { s: Session; productId: string; onEnd: (id: string) => void }) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);

  const doEnd = async () => {
    setEnding(true);
    await fetch(`/api/sessions/${s.id}/end`, { method: "POST" });
    onEnd(s.id);
    setEnding(false);
    setConfirmEnd(false);
  };

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{s.name ?? s.sprintName}</p>
        <p className="text-white/35 text-xs">{fmtDate(new Date(s.createdAt))} · {s._count.tickets} tickets</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Badge variant={s.status === "COMPLETED" ? "success" : s.status === "ACTIVE" ? "warning" : "ghost"}>
          {s.status}
        </Badge>
        {(s.status === "ACTIVE" || s.status === "WAITING") && (
          confirmEnd ? (
            <>
              <button onClick={doEnd} disabled={ending} className="text-[11px] px-2 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30">
                {ending ? "…" : "Confirm"}
              </button>
              <button onClick={() => setConfirmEnd(false)} className="text-[11px] px-2 py-0.5 rounded bg-white/8 text-white/40">Cancel</button>
            </>
          ) : (
            <button onClick={() => setConfirmEnd(true)} title="End session" className="p-1.5 rounded hover:bg-red-500/10 text-white/25 hover:text-red-400 transition-colors">
              <Square className="w-3.5 h-3.5" />
            </button>
          )
        )}
        <Link href={s.status === "COMPLETED" ? `/products/${productId}/sessions/${s.id}/summary` : `/products/${productId}/sessions/${s.id}/host`}>
          <Button size="sm" variant="ghost" title={s.status === "COMPLETED" ? "View summary" : "Open session"}>
            {s.status === "COMPLETED" ? <FileText className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
          </Button>
        </Link>
      </div>
    </div>
  );
}

export function SessionList({ productId, sessions }: { productId: string; sessions: Session[] }) {
  const router = useRouter();
  const [list, setList] = useState(sessions);
  const [showAllCompleted, setShowAllCompleted] = useState(false);

  const handleEnd = (id: string) => {
    setList((prev) => prev.map((s) => s.id === id ? { ...s, status: "COMPLETED" } : s));
    router.refresh();
  };

  const active = list.filter((s) => s.status === "ACTIVE");
  const waiting = list.filter((s) => s.status === "WAITING");
  const completed = list.filter((s) => s.status === "COMPLETED");
  const visibleCompleted = showAllCompleted ? completed : completed.slice(0, 3);

  if (list.length === 0) {
    return <p className="text-white/40 text-sm text-center py-6">No sessions yet</p>;
  }

  return (
    <div className="space-y-0">
      {[...active, ...waiting].map((s) => (
        <SessionRow key={s.id} s={s} productId={productId} onEnd={handleEnd} />
      ))}
      {completed.length > 0 && (active.length > 0 || waiting.length > 0) && (
        <div className="border-t border-white/8 mt-1 pt-1" />
      )}
      {visibleCompleted.map((s) => (
        <SessionRow key={s.id} s={s} productId={productId} onEnd={handleEnd} />
      ))}
      {completed.length > 3 && (
        <button
          onClick={() => setShowAllCompleted((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/50 transition-colors pt-2 w-full"
        >
          {showAllCompleted ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          {showAllCompleted ? "Show less" : `Show ${completed.length - 3} more completed sessions`}
        </button>
      )}
    </div>
  );
}
