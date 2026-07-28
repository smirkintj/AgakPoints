"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Member } from "@/types/models";
import type { CheckedInMember } from "@/types/partykit";
import { MemberAvatar } from "./MemberAvatar";
import { ChevronDown, ChevronRight, X } from "lucide-react";

interface SprintCalendarEvent {
  date: string;
  name: string;
  type: string; // "PH" | "DEPLOY"
  country?: string | null;
}

interface SprintCalendarProps {
  sessionId: string;
  startDate: Date | null;
  endDate: Date | null;
  members: Member[];
  checkedIn: CheckedInMember[];
  onLeaveToggle?: (memberId: string, date: string, active: boolean) => void;
  onCalendarSaved?: () => void;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function isoDate(d: Date): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function isWeekend(d: Date): boolean { const day = d.getDay(); return day === 0 || day === 6; }
function gridCol(d: Date): number { const day = d.getDay(); return day === 0 ? 6 : day - 1; }

function subWorkingDays(date: string, n: number, phDates: Set<string>, allDays: string[]): string | null {
  let cur = new Date(date);
  let remaining = n;
  while (remaining > 0) {
    cur = addDays(cur, -1);
    const ds = isoDate(cur);
    if (!isWeekend(cur) && !phDates.has(ds)) remaining--;
    if (!allDays.includes(ds) && cur < new Date(allDays[0])) return null;
  }
  return isoDate(cur);
}

export function SprintCalendar({ sessionId, startDate, endDate, members, onLeaveToggle, onCalendarSaved }: SprintCalendarProps) {
  const [events, setEvents] = useState<SprintCalendarEvent[]>([]);
  const [leaveMap, setLeaveMap] = useState<Record<string, Set<string>>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const [panelPH, setPanelPH] = useState(false);
  const [panelPHName, setPanelPHName] = useState("");
  const [panelPHCountry, setPanelPHCountry] = useState("");
  const [panelDeploy, setPanelDeploy] = useState(false);
  const [panelDeployName, setPanelDeployName] = useState("");

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}/leave`)
      .then((r) => r.json())
      .then((data: { leaves: { memberId: string; date: string }[] }) => {
        const map: Record<string, Set<string>> = {};
        for (const l of data.leaves) {
          if (!map[l.memberId]) map[l.memberId] = new Set();
          map[l.memberId].add(l.date);
        }
        setLeaveMap(map);
      }).catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}/holidays`)
      .then((r) => r.json())
      .then((data: { holidays: SprintCalendarEvent[] }) => setEvents(data.holidays ?? []))
      .catch(() => {});
  }, [sessionId]);

  // Refill the edit panel whenever a different day is selected. These are
  // user-editable fields seeded from the stored event, not derived values, so
  // they have to live in state; the update is queued so selecting a day doesn't
  // re-render twice before paint.
  useEffect(() => {
    if (!selectedDate) return;
    const ph = events.find((e) => e.date === selectedDate && e.type === "PH");
    const deploy = events.find((e) => e.date === selectedDate && e.type === "DEPLOY");
    const id = setTimeout(() => {
      setPanelPH(!!ph);
      setPanelPHName(ph?.name ?? "Public Holiday");
      setPanelPHCountry(ph?.country ?? "");
      setPanelDeploy(!!deploy);
      setPanelDeployName(deploy?.name ?? "");
    }, 0);
    return () => clearTimeout(id);
  }, [selectedDate, events]);

  if (!startDate || !endDate) return (
    <div className="text-center text-xs text-white/30 py-2">No sprint dates configured.</div>
  );

  const days: Date[] = [];
  let cur = new Date(startDate);
  const end = new Date(endDate);
  while (cur <= end) { days.push(new Date(cur)); cur = addDays(cur, 1); }
  const dayStrings = days.map(isoDate);

  const phDates = new Set(events.filter((e) => e.type === "PH").map((e) => e.date));
  const deployDates = new Set(events.filter((e) => e.type === "DEPLOY").map((e) => e.date));
  const workingDays = days.filter((d) => !isWeekend(d) && !phDates.has(isoDate(d)));

  const sanityDates = new Set<string>();
  const uatDates = new Set<string>();
  for (const dd of deployDates) {
    const s1 = subWorkingDays(dd, 1, phDates, dayStrings);
    const s2 = subWorkingDays(dd, 2, phDates, dayStrings);
    if (s1) sanityDates.add(s1);
    if (s2) sanityDates.add(s2);
    const uat = subWorkingDays(dd, 3, phDates, dayStrings);
    if (uat) uatDates.add(uat);
  }

  const toggleLeave = (memberId: string, dateStr: string) => {
    setLeaveMap((prev) => {
      const set = new Set(prev[memberId] ?? []);
      const active = !set.has(dateStr);
      if (active) set.add(dateStr); else set.delete(dateStr);
      fetch(`/api/sessions/${sessionId}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, date: dateStr, active }),
      }).then((r) => {
        if (!r.ok) r.json().then((e) => console.error("[leave] save failed", r.status, e)).catch(() => {});
        else onLeaveToggle?.(memberId, dateStr, active);
      }).catch((e) => console.error("[leave] save error", e));
      return { ...prev, [memberId]: set };
    });
  };

  const setEvent = (date: string, type: string, name: string, remove: boolean, country?: string | null) => {
    fetch(`/api/sessions/${sessionId}/holidays`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, type, name, remove, country }),
    }).then(() => {
      if (remove) {
        setEvents((prev) => prev.filter((e) => !(e.date === date && e.type === type)));
      } else {
        setEvents((prev) => {
          const filtered = prev.filter((e) => !(e.date === date && e.type === type));
          return [...filtered, { date, name, type, country }];
        });
      }
      onCalendarSaved?.();
    }).catch(() => {});
  };

  const formatDateLabel = (ds: string) => {
    const d = new Date(ds + "T12:00:00");
    return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} (${DAY_SHORT[d.getDay()]})`;
  };

  const firstDayCol = gridCol(days[0]);

  // Compact summary data
  const phList = events.filter((e) => e.type === "PH");
  const membersWithLeave = members.filter((m) => {
    const s = leaveMap[m.id];
    return s && [...s].some((d) => dayStrings.includes(d));
  });

  const dateRange = `${days[0].getDate()} ${MONTH_SHORT[days[0].getMonth()]} – ${days[days.length - 1].getDate()} ${MONTH_SHORT[days[days.length - 1].getMonth()]}`;

  return (
    <div className="w-full">
      {/* Collapsed / expanded toggle header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-2 text-xs text-white/40 hover:text-white/60 transition-colors w-full"
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
        <span className="font-medium text-white/50">Sprint Calendar</span>
        <span className="text-white/25 mx-1">·</span>
        <span className="text-white/30">{dateRange}</span>
        <span className="text-white/20 mx-1">·</span>
        <span className="text-white/30">{workingDays.length} WDs</span>
      </button>

      {/* Compact summary — always visible when collapsed */}
      {!expanded && (
        <div className="mt-1.5 pl-5 flex flex-wrap gap-x-4 gap-y-0.5">
          {phList.length > 0 && (
            <span className="text-[11px]">
              <span className="text-red-400/70 font-medium">PH</span>
              <span className="text-white/25 mx-1">·</span>
              <span className="text-white/35">{phList.map((h) => {
                const d = new Date(h.date + "T12:00:00");
                const label = `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
                return (h as { country?: string | null }).country ? `${label} (${(h as { country?: string | null }).country})` : label;
              }).join(", ")}</span>
            </span>
          )}
          {events.filter((e) => e.type === "DEPLOY").map((de) => {
            const fmtDs = (ds: string | null) => {
              if (!ds) return null;
              const d = new Date(ds + "T12:00:00");
              return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
            };
            const s1 = subWorkingDays(de.date, 1, phDates, dayStrings);
            const s2 = subWorkingDays(de.date, 2, phDates, dayStrings);
            const uat = subWorkingDays(de.date, 3, phDates, dayStrings);
            return (
              <span key={de.date} className="text-[11px] flex items-center gap-x-1.5 flex-wrap">
                <span className="text-violet-400/70 font-medium">Deploy</span>
                <span className="text-violet-300/60">{fmtDs(de.date)}</span>
                {(s1 || s2) && <><span className="text-white/20">·</span><span className="text-orange-400/60">Sanity {[fmtDs(s2), fmtDs(s1)].filter(Boolean).join("–")}</span></>}
                {uat && <><span className="text-white/20">·</span><span className="text-amber-400/60">UAT {fmtDs(uat)}</span></>}
              </span>
            );
          })}
          {membersWithLeave.length > 0 && (
            <span className="text-[11px]">
              <span className="text-amber-400/70 font-medium">Leave</span>
              <span className="text-white/25 mx-1">·</span>
              <span className="text-white/35">
                {membersWithLeave.map((m) => {
                  const leaveDays = [...(leaveMap[m.id] ?? [])].filter((d) => dayStrings.includes(d)).sort();
                  const fmtDs = (ds: string) => { const d = new Date(ds + "T12:00:00"); return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`; };
                  return `${m.name.split(" ")[0]} (${leaveDays.map(fmtDs).join(", ")})`;
                }).join(" · ")}
              </span>
            </span>
          )}
          {phList.length === 0 && events.filter((e) => e.type === "DEPLOY").length === 0 && membersWithLeave.length === 0 && (
            <span className="text-[11px] text-white/20">No events this sprint</span>
          )}
        </div>
      )}

      {/* Full grid — expanded */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 max-w-sm mx-auto">
              {/* Legend */}
              <div className="flex items-center gap-4 text-[10px] text-white/25 mb-2 flex-wrap">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500/30 inline-block border border-red-500/20" /> Public Holiday</span>
                {events.some((e) => e.type === "DEPLOY") && (
                  <>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-violet-500/30 inline-block border border-violet-500/20" /> Deployment</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-orange-500/20 inline-block" /> Sanity</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500/20 inline-block" /> UAT</span>
                  </>
                )}
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-px mb-px">
                {DAY_NAMES.map((d) => (
                  <div key={d} className="text-center text-[10px] text-white/20 font-medium py-1">{d}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-px">
                {Array.from({ length: firstDayCol }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}
                {days.map((d) => {
                  const ds = isoDate(d);
                  const weekend = isWeekend(d);
                  const phEvent = events.find((e) => e.date === ds && e.type === "PH");
                  const deployEvent = events.find((e) => e.date === ds && e.type === "DEPLOY");
                  const isSanity = sanityDates.has(ds) && !deployEvent && !phEvent;
                  const isUAT = uatDates.has(ds) && !deployEvent && !phEvent && !isSanity;
                  const isSelected = selectedDate === ds;
                  const membersOnLeave = members.filter((m) => leaveMap[m.id]?.has(ds));

                  let bgClass = weekend ? "bg-white/5" : "bg-white/4 hover:bg-white/8";
                  let borderClass = "border border-transparent";
                  if (phEvent) { bgClass = "bg-red-500/15"; borderClass = "border border-red-500/20"; }
                  else if (deployEvent) { bgClass = "bg-violet-500/15"; borderClass = "border border-violet-500/20"; }
                  else if (isSanity) { bgClass = "bg-orange-500/10"; }
                  else if (isUAT) { bgClass = "bg-amber-500/10"; }
                  if (isSelected) borderClass = "border border-violet-400/60";

                  return (
                    <button
                      key={ds}
                      onClick={() => setSelectedDate(isSelected ? null : ds)}
                      className={`${bgClass} ${borderClass} rounded-sm p-0.5 flex flex-col gap-0.5 text-left transition-colors cursor-pointer w-full aspect-square overflow-hidden`}
                    >
                      <span className={`text-[10px] font-bold leading-none ${weekend ? "text-white/20" : "text-white/60"}`}>{d.getDate()}</span>
                      {phEvent && <span className="text-[7px] bg-red-500/30 text-red-300 px-0.5 rounded truncate max-w-full block leading-tight">{phEvent.name}</span>}
                      {phEvent && phEvent.country && <span className="text-[6px] text-red-300/60 leading-tight">{phEvent.country}</span>}
                      {deployEvent && <span className="text-[7px] bg-violet-500/30 text-violet-300 px-0.5 rounded truncate max-w-full block leading-tight">Deploy</span>}
                      {isSanity && <span className="text-[6px] text-orange-400/70 leading-tight">Sanity</span>}
                      {isUAT && <span className="text-[6px] text-amber-400/70 leading-tight">UAT</span>}
                      {membersOnLeave.length > 0 && (
                        <div className="flex gap-px flex-wrap mt-auto">
                          {membersOnLeave.slice(0, 3).map((m) => {
                            const avSize = membersOnLeave.length >= 3 ? 11 : membersOnLeave.length === 2 ? 14 : 18;
                            return (
                              <div key={m.id} className="relative group/av">
                                <MemberAvatar name={m.name} role={m.role} size={avSize} />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 rounded bg-black/80 border border-white/15 text-[10px] text-white/80 whitespace-nowrap pointer-events-none opacity-0 group-hover/av:opacity-100 transition-opacity z-50">
                                  {m.name.split(" ")[0]}
                                </div>
                              </div>
                            );
                          })}
                          {membersOnLeave.length > 3 && <span className="text-[7px] text-white/30 self-center">+{membersOnLeave.length - 3}</span>}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Detail panel */}
              {selectedDate && (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">{formatDateLabel(selectedDate)}</span>
                    <button onClick={() => setSelectedDate(null)} className="text-white/30 hover:text-white/70"><X className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="panel-ph" checked={panelPH}
                      onChange={(e) => { const c = e.target.checked; setPanelPH(c); setEvent(selectedDate, "PH", panelPHName || "Public Holiday", !c, panelPHCountry || null); }}
                      className="rounded" />
                    <label htmlFor="panel-ph" className="text-xs text-white/60 w-28">Public Holiday</label>
                    <input type="text" value={panelPHName} onChange={(e) => setPanelPHName(e.target.value)}
                      onBlur={() => { if (panelPH) setEvent(selectedDate, "PH", panelPHName || "Public Holiday", false, panelPHCountry || null); }}
                      disabled={!panelPH} placeholder="Holiday name"
                      className="flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-white/20 focus:border-violet-500 focus:outline-none disabled:opacity-30" />
                    {(() => {
                      const countries = [...new Set(members.map((m) => (m as { country?: string | null }).country).filter(Boolean) as string[])];
                      return countries.length > 0 ? (
                        <select
                          value={panelPHCountry}
                          onChange={(e) => {
                            setPanelPHCountry(e.target.value);
                            if (panelPH) setEvent(selectedDate, "PH", panelPHName || "Public Holiday", false, e.target.value || null);
                          }}
                          disabled={!panelPH}
                          className="w-28 rounded border border-white/10 bg-[#0d0b1a] px-2 py-1 text-xs text-white focus:border-violet-500 focus:outline-none disabled:opacity-30"
                        >
                          <option value="">All countries</option>
                          {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : null;
                    })()}
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="panel-deploy" checked={panelDeploy}
                      onChange={(e) => { const c = e.target.checked; setPanelDeploy(c); setEvent(selectedDate, "DEPLOY", panelDeployName || "Deploy", !c); }}
                      className="rounded" />
                    <label htmlFor="panel-deploy" className="text-xs text-white/60 w-28">Deployment</label>
                    <input type="text" value={panelDeployName} onChange={(e) => setPanelDeployName(e.target.value)}
                      onBlur={() => { if (panelDeploy) setEvent(selectedDate, "DEPLOY", panelDeployName || "Deploy", false); }}
                      disabled={!panelDeploy} placeholder="Deploy note (optional)"
                      className="flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-white/20 focus:border-violet-500 focus:outline-none disabled:opacity-30" />
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-widest font-medium mb-2">On leave</p>
                    <div className="flex flex-wrap gap-1.5">
                      {members.map((m) => {
                        const onLeave = leaveMap[m.id]?.has(selectedDate) ?? false;
                        return (
                          <button key={m.id} onClick={() => toggleLeave(m.id, selectedDate)}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full border transition-all text-xs ${onLeave ? "border-amber-500/60 bg-amber-500/20 text-amber-300" : "border-white/10 bg-white/5 text-white/40 hover:border-white/20"}`}>
                            <MemberAvatar name={m.name} role={m.role} size={14} />
                            <span>{m.name.split(" ")[0]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
