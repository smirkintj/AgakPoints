"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, FileText, ChevronDown, ChevronRight, Square, Pencil, Check, X } from "lucide-react";

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtDate(d: Date) { return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`; }

type Session = {
  id: string;
  name?: string | null;
  sprintName: string;
  createdAt: Date;
  status: string;
  _count: { tickets: number };
  estimatedCount: number;
  totalPts: number;
  attendeeCount: number;
};

function SessionRow({ s, productId, onEnd, onRename }: { s: Session; productId: string; onEnd: (id: string) => void; onRename: (id: string, name: string) => void }) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(s.name ?? s.sprintName);
  const [savingName, setSavingName] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const doEnd = async () => {
    setEnding(true);
    await fetch(`/api/sessions/${s.id}/end`, { method: "POST" });
    onEnd(s.id);
    setEnding(false);
    setConfirmEnd(false);
  };

  const startRename = () => {
    setRenameVal(s.name ?? s.sprintName);
    setRenaming(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const saveRename = async () => {
    if (!renameVal.trim()) return;
    setSavingName(true);
    const res = await fetch(`/api/sessions/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameVal.trim() }),
    });
    if (res.ok) {
      onRename(s.id, renameVal.trim());
    }
    setSavingName(false);
    setRenaming(false);
  };

  const cancelRename = () => {
    setRenaming(false);
    setRenameVal(s.name ?? s.sprintName);
  };

  return (
    <div className="group flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
      <div className="flex-1 min-w-0">
        {renaming ? (
          <div className="flex items-center gap-1.5">
            <input
              ref={inputRef}
              value={renameVal}
              onChange={(e) => setRenameVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveRename();
                if (e.key === "Escape") cancelRename();
              }}
              className="flex-1 min-w-0 bg-white/8 border border-violet-500/50 rounded px-2 py-0.5 text-sm text-white focus:outline-none"
            />
            <button onClick={saveRename} disabled={savingName} className="p-1 rounded hover:bg-white/8 text-emerald-400">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={cancelRename} className="p-1 rounded hover:bg-white/8 text-white/30">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <p className="text-white text-sm font-medium truncate">{s.name ?? s.sprintName}</p>
            <button
              onClick={startRename}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/8 text-white/30 hover:text-white/60"
              title="Rename session"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        )}
        <p className="text-white/35 text-xs">
          {fmtDate(new Date(s.createdAt))} · {s.estimatedCount}/{s._count.tickets} estimated · {s.totalPts} pts · {s.attendeeCount} attended
        </p>
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

  const handleRename = (id: string, name: string) => {
    setList((prev) => prev.map((s) => s.id === id ? { ...s, name } : s));
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
        <SessionRow key={s.id} s={s} productId={productId} onEnd={handleEnd} onRename={handleRename} />
      ))}
      {completed.length > 0 && (active.length > 0 || waiting.length > 0) && (
        <div className="border-t border-white/8 mt-1 pt-1" />
      )}
      {completed.length > 3 && (
        <button
          onClick={() => setShowAllCompleted((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/50 transition-colors pb-1 w-full"
        >
          {showAllCompleted ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          {showAllCompleted ? "Show less" : `Show ${completed.length - 3} more completed sessions`}
        </button>
      )}
      {visibleCompleted.map((s) => (
        <SessionRow key={s.id} s={s} productId={productId} onEnd={handleEnd} onRename={handleRename} />
      ))}
    </div>
  );
}
