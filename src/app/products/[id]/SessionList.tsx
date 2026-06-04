"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, FileText, Pencil, Check, X, Square, ExternalLink } from "lucide-react";

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtDate(d: Date) { return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`; }
function monthKey(d: Date) { return `${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`; }

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

type TicketSummary = {
  id: string;
  jiraKey: string;
  title: string;
  status: string;
  finalEstimate: number | null;
};

function InlineRename({ value, onSave, onCancel }: { value: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState(value);
  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0" onClick={(e) => e.preventDefault()}>
      <input
        value={val}
        autoFocus
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onSave(val); if (e.key === "Escape") onCancel(); }}
        className="flex-1 min-w-0 bg-white/8 border border-violet-500/50 rounded-lg px-2 py-0.5 text-sm text-white focus:outline-none"
      />
      <button onClick={() => onSave(val)} className="p-1 rounded hover:bg-white/8 text-emerald-400"><Check className="w-3.5 h-3.5" /></button>
      <button onClick={onCancel} className="p-1 rounded hover:bg-white/8 text-white/30"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

// Active / waiting session — elevated card
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
    <div style={{ background: "linear-gradient(135deg,#1a1035,#0f0c22)", border: "1px solid #7c3aed44", borderRadius: 14, padding: "16px 18px", boxShadow: "0 0 28px #7c3aed10", marginBottom: 8 }}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${isWaiting ? "bg-amber-400" : "bg-emerald-400"}`}
          style={isWaiting ? undefined : { boxShadow: "0 0 8px #10b98199", animation: "pulse 2s infinite" }} />
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: isWaiting ? "#f59e0b" : "#10b981" }}>
          {isWaiting ? "Waiting to start" : "Live now"}
        </span>
      </div>

      {renaming ? (
        <InlineRename value={s.name ?? s.sprintName} onSave={saveRename} onCancel={() => setRenaming(false)} />
      ) : (
        <div className="flex items-center gap-1.5 group mb-0.5">
          <h3 className="text-white font-bold text-[15px] leading-snug">{s.name ?? s.sprintName}</h3>
          <button onClick={() => setRenaming(true)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/8 text-white/25"><Pencil className="w-3 h-3" /></button>
        </div>
      )}
      <p className="text-[11px] text-white/30 mb-4">{s.sprintName} · Started {fmtDate(new Date(s.createdAt))}</p>

      <div className="flex gap-6 mb-4">
        {[{ val: s.totalPts, lbl: "SP locked" }, { val: `${s.estimatedCount}/${s._count.tickets}`, lbl: "Tickets" }, { val: s.attendeeCount, lbl: "Attending" }].map(({ val, lbl }) => (
          <div key={lbl}>
            <div className="text-[20px] font-black text-violet-300 font-mono leading-none">{val}</div>
            <div className="text-[10px] text-white/25 mt-0.5">{lbl}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Link href={`/products/${productId}/sessions/${s.id}/host`} className="flex-1">
          <button className="w-full py-2 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)" }}>
            Open host view ↗
          </button>
        </Link>
        {confirmEnd ? (
          <div className="flex gap-1.5">
            <button onClick={doEnd} disabled={ending} className="text-xs px-3 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30">{ending ? "…" : "Confirm end"}</button>
            <button onClick={() => setConfirmEnd(false)} className="text-xs px-3 py-2 rounded-xl bg-white/8 text-white/40">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmEnd(true)} className="p-2 rounded-xl border border-white/10 hover:border-red-500/30 hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors">
            <Square className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// Expandable completed session row
function CompletedRow({ s, productId, onRename, maxPts }: { s: Session; productId: string; onRename: (id: string, name: string) => void; maxPts: number }) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [tickets, setTickets] = useState<TicketSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  const pct = maxPts > 0 ? Math.round((s.totalPts / maxPts) * 100) : 0;

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !fetchedRef.current) {
      fetchedRef.current = true;
      setLoading(true);
      try {
        const res = await fetch(`/api/sessions/${s.id}`);
        const data = await res.json();
        setTickets((data.tickets ?? []).map((t: TicketSummary) => ({
          id: t.id, jiraKey: t.jiraKey, title: t.title, status: t.status, finalEstimate: t.finalEstimate,
        })));
      } catch { /* ignore */ }
      setLoading(false);
    }
  };

  const saveRename = async (val: string) => {
    if (!val.trim()) return;
    const res = await fetch(`/api/sessions/${s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: val.trim() }) });
    if (res.ok) onRename(s.id, val.trim());
    setRenaming(false);
  };

  const estimated = tickets?.filter((t) => t.status === "ESTIMATED") ?? [];
  const unpointed = tickets?.filter((t) => t.status !== "ESTIMATED") ?? [];

  return (
    <div className="border-b border-white/6 last:border-0">
      {/* Header row */}
      <div
        className="group flex items-center gap-3 py-2.5 px-2 rounded-xl hover:bg-white/[0.03] transition-colors cursor-pointer -mx-2"
        onClick={toggle}
      >
        <div className="text-white/20 shrink-0">
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </div>

        <div className="flex-1 min-w-0">
          {renaming ? (
            <InlineRename value={s.name ?? s.sprintName} onSave={saveRename} onCancel={() => setRenaming(false)} />
          ) : (
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-white/55 group-hover:text-white/80 transition-colors truncate">{s.name ?? s.sprintName}</p>
              <button
                onClick={(e) => { e.stopPropagation(); setRenaming(true); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/8 text-white/20 hover:text-white/50 shrink-0"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          )}
          <p className="text-[10px] text-white/25 mt-0.5">{fmtDate(new Date(s.createdAt))} · {s.estimatedCount}/{s._count.tickets} estimated · {s.attendeeCount} attended</p>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-sm font-bold font-mono text-white/30 group-hover:text-violet-400 transition-colors">{s.totalPts} SP</span>
          <div style={{ width: 56, height: 3, background: "#ffffff08", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#7c3aed88,#a78bfaaa)", borderRadius: 2 }} />
          </div>
        </div>

        <Link href={`/products/${productId}/sessions/${s.id}/summary`} onClick={(e) => e.stopPropagation()}>
          <FileText className="w-3.5 h-3.5 text-white/15 hover:text-white/50 transition-colors shrink-0" />
        </Link>
      </div>

      {/* Expanded ticket list */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="ml-5 mb-3 rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
              {loading ? (
                <div className="px-4 py-5 text-xs text-white/25 text-center">Loading…</div>
              ) : tickets === null ? null : (
                <>
                  {/* Pointed tickets */}
                  {estimated.length > 0 && (
                    <div>
                      <div className="px-3 pt-3 pb-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-white/20">Pointed — {estimated.length} tickets</span>
                      </div>
                      {estimated.map((t) => (
                        <div key={t.id} className="flex items-center gap-3 px-3 py-2 border-t border-white/5">
                          <span className="text-[10px] font-mono text-violet-400/60 shrink-0 w-16 truncate">{t.jiraKey}</span>
                          <span className="text-xs text-white/50 flex-1 truncate">{t.title}</span>
                          <span className="text-xs font-bold font-mono text-emerald-400 shrink-0">{t.finalEstimate} SP</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Unpointed tickets */}
                  {unpointed.length > 0 && (
                    <div>
                      <div className={`px-3 pb-1.5 ${estimated.length > 0 ? "pt-3 border-t border-white/8" : "pt-3"}`}>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-white/20">Not pointed — {unpointed.length} tickets</span>
                      </div>
                      {unpointed.map((t) => (
                        <div key={t.id} className="flex items-center gap-3 px-3 py-2 border-t border-white/5 opacity-40">
                          <span className="text-[10px] font-mono text-white/40 shrink-0 w-16 truncate">{t.jiraKey}</span>
                          <span className="text-xs text-white/40 flex-1 truncate">{t.title}</span>
                          <span className="text-xs font-mono text-white/20 shrink-0">—</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {tickets.length === 0 && (
                    <div className="px-4 py-5 text-xs text-white/20 text-center">No tickets</div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Group sessions by calendar month
function groupByMonth(sessions: Session[]): { month: string; sessions: Session[] }[] {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    const key = monthKey(new Date(s.createdAt));
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return Array.from(map.entries()).map(([month, sessions]) => ({ month, sessions }));
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

  // Show only first 2 months collapsed; rest behind "show more"
  const groups = groupByMonth(completed);
  const visibleGroups = showAll ? groups : groups.slice(0, 2);
  const hiddenCount = completed.slice(visibleGroups.reduce((n, g) => n + g.sessions.length, 0)).length;

  if (list.length === 0) return <p className="text-white/30 text-sm text-center py-8">No sessions yet</p>;

  return (
    <div className="space-y-6">
      {/* Active / waiting */}
      {active.map((s) => (
        <ActiveCard key={s.id} s={s} productId={productId} onEnd={handleEnd} onRename={handleRename} />
      ))}

      {/* Completed grouped by month */}
      {visibleGroups.map(({ month, sessions: group }) => (
        <div key={month}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/20 mb-2 px-1">{month}</p>
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-1">
            {group.map((s) => (
              <CompletedRow key={s.id} s={s} productId={productId} onRename={handleRename} maxPts={maxPts} />
            ))}
          </div>
        </div>
      ))}

      {!showAll && hiddenCount > 0 && (
        <button onClick={() => setShowAll(true)} className="w-full text-center text-xs text-white/25 hover:text-white/50 transition-colors py-1">
          ↓ {hiddenCount} more session{hiddenCount !== 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
}
