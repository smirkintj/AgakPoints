"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink, FileText, Pencil, Check, X, Square } from "lucide-react";

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

function InlineRename({ value, onSave, onCancel }: { value: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <input
        ref={ref}
        value={val}
        autoFocus
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onSave(val); if (e.key === "Escape") onCancel(); }}
        className="flex-1 min-w-0 bg-white/8 border border-violet-500/50 rounded px-2 py-0.5 text-sm text-white focus:outline-none"
      />
      <button onClick={() => onSave(val)} className="p-1 rounded hover:bg-white/8 text-emerald-400"><Check className="w-3.5 h-3.5" /></button>
      <button onClick={onCancel} className="p-1 rounded hover:bg-white/8 text-white/30"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

function ActiveCard({ s, productId, onEnd, onRename }: { s: Session; productId: string; onEnd: (id: string) => void; onRename: (id: string, name: string) => void }) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [renaming, setRenaming] = useState(false);

  const doEnd = async () => {
    setEnding(true);
    await fetch(`/api/sessions/${s.id}/end`, { method: "POST" });
    onEnd(s.id);
    setEnding(false);
    setConfirmEnd(false);
  };

  const saveRename = async (val: string) => {
    if (!val.trim()) return;
    const res = await fetch(`/api/sessions/${s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: val.trim() }) });
    if (res.ok) onRename(s.id, val.trim());
    setRenaming(false);
  };

  const isWaiting = s.status === "WAITING";

  return (
    <div style={{ background: "linear-gradient(135deg,#1a1035,#0f0c22)", border: "1px solid #7c3aed44", borderRadius: 14, padding: "18px 20px", boxShadow: "0 0 32px #7c3aed14" }}>
      {/* Eyebrow */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full shrink-0 ${isWaiting ? "bg-amber-400" : "bg-emerald-400"}`}
          style={isWaiting ? undefined : { boxShadow: "0 0 8px #10b98199", animation: "pulse 2s infinite" }} />
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: isWaiting ? "#f59e0b" : "#10b981" }}>
          {isWaiting ? "Waiting to start" : "Live now"}
        </span>
      </div>

      {/* Name */}
      <div className="mb-1">
        {renaming ? (
          <InlineRename value={s.name ?? s.sprintName} onSave={saveRename} onCancel={() => setRenaming(false)} />
        ) : (
          <div className="flex items-center gap-1.5 group">
            <h3 className="text-white font-bold text-base leading-snug">{s.name ?? s.sprintName}</h3>
            <button onClick={() => setRenaming(true)} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/8 text-white/30">
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        )}
        <p className="text-[11px] text-white/30 mt-0.5">{s.sprintName} · Started {fmtDate(new Date(s.createdAt))}</p>
      </div>

      {/* Stats row */}
      <div className="flex gap-5 mt-4 mb-5">
        {[
          { val: s.totalPts, lbl: "SP locked" },
          { val: `${s.estimatedCount}/${s._count.tickets}`, lbl: "Tickets" },
          { val: s.attendeeCount, lbl: "Attending" },
        ].map(({ val, lbl }) => (
          <div key={lbl}>
            <div className="text-xl font-black text-violet-300 font-mono leading-none">{val}</div>
            <div className="text-[10px] text-white/30 mt-0.5">{lbl}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Link href={`/products/${productId}/sessions/${s.id}/host`} className="flex-1">
          <button className="w-full py-2 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", boxShadow: "0 4px 16px #7c3aed33" }}>
            Open host view ↗
          </button>
        </Link>
        {confirmEnd ? (
          <div className="flex gap-1.5">
            <button onClick={doEnd} disabled={ending} className="text-xs px-3 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30">
              {ending ? "…" : "Confirm end"}
            </button>
            <button onClick={() => setConfirmEnd(false)} className="text-xs px-3 py-2 rounded-xl bg-white/8 text-white/40">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmEnd(true)} className="p-2 rounded-xl border border-white/10 hover:border-red-500/30 hover:bg-red-500/10 text-white/25 hover:text-red-400 transition-colors">
            <Square className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// Max SP across completed sessions for bar scaling
function SpBar({ pts, max }: { pts: number; max: number }) {
  const pct = max > 0 ? Math.round((pts / max) * 100) : 0;
  return (
    <div style={{ width: 64, height: 3, background: "#ffffff0a", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#7c3aed88,#a78bfaaa)", borderRadius: 2 }} />
    </div>
  );
}

function HistoryRow({ s, productId, onRename, maxPts }: { s: Session; productId: string; onRename: (id: string, name: string) => void; maxPts: number }) {
  const [renaming, setRenaming] = useState(false);

  const saveRename = async (val: string) => {
    if (!val.trim()) return;
    const res = await fetch(`/api/sessions/${s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: val.trim() }) });
    if (res.ok) onRename(s.id, val.trim());
    setRenaming(false);
  };

  return (
    <Link href={`/products/${productId}/sessions/${s.id}/summary`} className="group flex items-center gap-3 py-3 border-b border-white/6 last:border-0 hover:bg-white/[0.02] rounded-lg px-2 -mx-2 transition-colors">
      <div className="w-1.5 h-1.5 rounded-full bg-white/15 shrink-0" />
      <div className="flex-1 min-w-0">
        {renaming ? (
          <InlineRename value={s.name ?? s.sprintName} onSave={saveRename} onCancel={() => setRenaming(false)} />
        ) : (
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-white/55 group-hover:text-white/80 transition-colors truncate">{s.name ?? s.sprintName}</p>
            <button
              onClick={(e) => { e.preventDefault(); setRenaming(true); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/8 text-white/20 hover:text-white/50 shrink-0"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        )}
        <p className="text-[10px] text-white/25 mt-0.5">{fmtDate(new Date(s.createdAt))} · {s.estimatedCount}/{s._count.tickets} estimated · {s.attendeeCount} attended</p>
      </div>
      <div className="text-right shrink-0 flex flex-col items-end gap-1">
        <span className="text-sm font-bold font-mono text-white/30 group-hover:text-violet-400 transition-colors">{s.totalPts} SP</span>
        <SpBar pts={s.totalPts} max={maxPts} />
      </div>
      <FileText className="w-3.5 h-3.5 text-white/15 group-hover:text-white/40 transition-colors shrink-0" />
    </Link>
  );
}

export function SessionList({ productId, sessions }: { productId: string; sessions: Session[] }) {
  const router = useRouter();
  const [list, setList] = useState(sessions);
  const [showAll, setShowAll] = useState(false);

  const handleEnd = (id: string) => {
    setList((prev) => prev.map((s) => s.id === id ? { ...s, status: "COMPLETED" } : s));
    router.refresh();
  };

  const handleRename = (id: string, name: string) => setList((prev) => prev.map((s) => s.id === id ? { ...s, name } : s));

  const active = list.filter((s) => s.status === "ACTIVE" || s.status === "WAITING");
  const completed = list.filter((s) => s.status === "COMPLETED");
  const maxPts = Math.max(...completed.map((s) => s.totalPts), 1);
  const visible = showAll ? completed : completed.slice(0, 5);

  if (list.length === 0) return <p className="text-white/30 text-sm text-center py-8">No sessions yet</p>;

  return (
    <div className="space-y-5">
      {/* Active / waiting */}
      {active.map((s) => (
        <ActiveCard key={s.id} s={s} productId={productId} onEnd={handleEnd} onRename={handleRename} />
      ))}

      {/* History */}
      {completed.length > 0 && (
        <div>
          {active.length > 0 && <p className="text-[10px] font-bold uppercase tracking-widest text-white/20 mb-3">History</p>}
          <div>
            {visible.map((s) => (
              <HistoryRow key={s.id} s={s} productId={productId} onRename={handleRename} maxPts={maxPts} />
            ))}
          </div>
          {completed.length > 5 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="mt-2 text-xs text-white/25 hover:text-white/50 transition-colors w-full text-center py-1"
            >
              {showAll ? "Show less" : `↓ ${completed.length - 5} more sessions`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
