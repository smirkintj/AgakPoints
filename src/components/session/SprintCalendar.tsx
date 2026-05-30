"use client";
import { useState, useEffect } from "react";
import type { Member } from "@/types/models";
import type { CheckedInMember } from "@/types/partykit";
import { MemberAvatar } from "./MemberAvatar";
import { X } from "lucide-react";

interface SprintCalendarEvent {
  date: string;
  name: string;
  type: string; // "PH" | "DEPLOY"
}

interface SprintCalendarProps {
  sessionId: string;
  startDate: Date | null;
  endDate: Date | null;
  members: Member[];
  checkedIn: CheckedInMember[];
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

// Returns 0=Mon..6=Sun for CSS grid
function gridCol(d: Date): number {
  const day = d.getDay(); // 0=Sun, 1=Mon..6=Sat
  return day === 0 ? 6 : day - 1;
}

// Subtract n working days (skip weekends + holidays)
function subWorkingDays(date: string, n: number, phDates: Set<string>, allDays: string[]): string | null {
  let cur = new Date(date);
  let remaining = n;
  while (remaining > 0) {
    cur = addDays(cur, -1);
    const ds = isoDate(cur);
    if (!isWeekend(cur) && !phDates.has(ds)) {
      remaining--;
    }
    // Safety: don't go beyond sprint start
    if (!allDays.includes(ds) && cur < new Date(allDays[0])) return null;
  }
  return isoDate(cur);
}

export function SprintCalendar({
  sessionId,
  startDate,
  endDate,
  members,
  checkedIn,
}: SprintCalendarProps) {
  const [events, setEvents] = useState<SprintCalendarEvent[]>([]);
  const [leaveMap, setLeaveMap] = useState<Record<string, Set<string>>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Panel state
  const [panelPH, setPanelPH] = useState(false);
  const [panelPHName, setPanelPHName] = useState("");
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
      })
      .catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}/holidays`)
      .then((r) => r.json())
      .then((data: { holidays: SprintCalendarEvent[] }) => {
        setEvents(data.holidays ?? []);
      })
      .catch(() => {});
  }, [sessionId]);

  // Update panel state when selected date changes
  useEffect(() => {
    if (!selectedDate) return;
    const ph = events.find((e) => e.date === selectedDate && e.type === "PH");
    const deploy = events.find((e) => e.date === selectedDate && e.type === "DEPLOY");
    setPanelPH(!!ph);
    setPanelPHName(ph?.name ?? "Public Holiday");
    setPanelDeploy(!!deploy);
    setPanelDeployName(deploy?.name ?? "");
  }, [selectedDate, events]);

  if (!startDate || !endDate) {
    return (
      <div className="text-center text-xs text-white/30 py-4">
        No sprint dates configured.
      </div>
    );
  }

  // Build day array
  const days: Date[] = [];
  let cur = new Date(startDate);
  const end = new Date(endDate);
  while (cur <= end) {
    days.push(new Date(cur));
    cur = addDays(cur, 1);
  }
  const dayStrings = days.map(isoDate);

  const phDates = new Set(events.filter((e) => e.type === "PH").map((e) => e.date));
  const deployDates = new Set(events.filter((e) => e.type === "DEPLOY").map((e) => e.date));

  const workingDays = days.filter((d) => !isWeekend(d) && !phDates.has(isoDate(d)));

  // Compute sanity / UAT windows
  const sanityDates = new Set<string>();
  const uatDates = new Set<string>();
  for (const dd of deployDates) {
    // Sanity window = 2 WDs before deploy (accounts for overlapping PHs)
    const sanity1 = subWorkingDays(dd, 1, phDates, dayStrings);
    const sanity2 = subWorkingDays(dd, 2, phDates, dayStrings);
    if (sanity1) sanityDates.add(sanity1);
    if (sanity2) sanityDates.add(sanity2);
    const uat = subWorkingDays(dd, 3, phDates, dayStrings);
    if (uat) uatDates.add(uat);
  }

  const toggleLeave = (memberId: string, dateStr: string) => {
    setLeaveMap((prev) => {
      const set = new Set(prev[memberId] ?? []);
      const active = !set.has(dateStr);
      if (active) set.add(dateStr);
      else set.delete(dateStr);
      fetch(`/api/sessions/${sessionId}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, date: dateStr, active }),
      }).catch(() => {});
      return { ...prev, [memberId]: set };
    });
  };

  const setEvent = (date: string, type: string, name: string, remove: boolean) => {
    fetch(`/api/sessions/${sessionId}/holidays`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, type, name, remove }),
    })
      .then(() => {
        if (remove) {
          setEvents((prev) => prev.filter((e) => !(e.date === date && e.type === type)));
        } else {
          setEvents((prev) => {
            const filtered = prev.filter((e) => !(e.date === date && e.type === type));
            return [...filtered, { date, name, type }];
          });
        }
      })
      .catch(() => {});
  };

  // Number of empty cells before first day
  const firstDayCol = gridCol(days[0]);

  const formatDateLabel = (ds: string) => {
    const d = new Date(ds);
    return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} (${DAY_SHORT[d.getDay()]})`;
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center gap-3 text-xs mb-3">
        <span className="text-white/50 font-medium">Sprint Calendar</span>
        <span className="text-white/20">·</span>
        <span className="text-white/35">
          {days[0] && `${days[0].getDate()} ${MONTH_SHORT[days[0].getMonth()]}`}
          {" – "}
          {days[days.length - 1] && `${days[days.length - 1].getDate()} ${MONTH_SHORT[days[days.length - 1].getMonth()]}`}
        </span>
        <span className="text-white/20">·</span>
        <span className="text-white/35">{workingDays.length} working days</span>
      </div>

      {/* Legend — only show entries that are relevant to this sprint */}
      <div className="flex items-center gap-4 text-[10px] text-white/25 mb-2 flex-wrap">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500/30 inline-block border border-red-500/20" /> Public Holiday</span>
        {events.some((e) => e.type === "DEPLOY") && (
          <>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-violet-500/30 inline-block border border-violet-500/20" /> Deployment</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-orange-500/20 inline-block" /> Sanity window</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500/20 inline-block" /> UAT signoff</span>
          </>
        )}
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-px mb-px">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-[9px] text-white/20 font-medium py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px">
        {/* Empty cells for alignment */}
        {Array.from({ length: firstDayCol }).map((_, i) => (
          <div key={`empty-${i}`} />
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
          if (isSelected) { borderClass = "border border-violet-400/60"; }

          return (
            <button
              key={ds}
              onClick={() => setSelectedDate(isSelected ? null : ds)}
              className={`${bgClass} ${borderClass} rounded-sm p-1 min-h-[60px] flex flex-col gap-0.5 text-left transition-colors cursor-pointer`}
            >
              <div className="flex items-baseline gap-0.5">
                <span className={`text-xs font-bold ${weekend ? "text-white/20" : "text-white/70"}`}>{d.getDate()}</span>
                <span className="text-[8px] text-white/20">{DAY_SHORT[d.getDay()]}</span>
              </div>

              {phEvent && (
                <span className="text-[8px] bg-red-500/30 text-red-300 px-1 py-0.5 rounded truncate max-w-full block leading-tight">
                  {phEvent.name}
                </span>
              )}
              {deployEvent && (
                <span className="text-[8px] bg-violet-500/30 text-violet-300 px-1 py-0.5 rounded truncate max-w-full block leading-tight">
                  {deployEvent.name || "Deploy"}
                </span>
              )}
              {isSanity && (
                <span className="text-[7px] text-orange-400/70 leading-tight">Sanity</span>
              )}
              {isUAT && (
                <span className="text-[7px] text-amber-400/70 leading-tight">UAT signoff</span>
              )}

              {/* Member avatars on leave */}
              {membersOnLeave.length > 0 && (
                <div className="flex gap-0.5 flex-wrap mt-auto">
                  {membersOnLeave.slice(0, 3).map((m) => (
                    <MemberAvatar key={m.id} name={m.name} role={m.role} size={20} title={m.name.split(" ")[0]} />
                  ))}
                  {membersOnLeave.length > 3 && (
                    <span className="text-[7px] text-white/30 leading-none self-center">+{membersOnLeave.length - 3}</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Detail panel */}
      {selectedDate && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white">{formatDateLabel(selectedDate)}</span>
            <button onClick={() => setSelectedDate(null)} className="text-white/30 hover:text-white/70 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Public Holiday */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="panel-ph"
              checked={panelPH}
              onChange={(e) => {
                const checked = e.target.checked;
                setPanelPH(checked);
                if (!checked) {
                  setEvent(selectedDate, "PH", panelPHName, true);
                } else {
                  setEvent(selectedDate, "PH", panelPHName || "Public Holiday", false);
                }
              }}
              className="rounded"
            />
            <label htmlFor="panel-ph" className="text-xs text-white/60 w-28">Public Holiday</label>
            <input
              type="text"
              value={panelPHName}
              onChange={(e) => setPanelPHName(e.target.value)}
              onBlur={() => {
                if (panelPH) setEvent(selectedDate, "PH", panelPHName || "Public Holiday", false);
              }}
              disabled={!panelPH}
              placeholder="Holiday name"
              className="flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-white/20 focus:border-violet-500 focus:outline-none disabled:opacity-30"
            />
          </div>

          {/* Deployment */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="panel-deploy"
              checked={panelDeploy}
              onChange={(e) => {
                const checked = e.target.checked;
                setPanelDeploy(checked);
                if (!checked) {
                  setEvent(selectedDate, "DEPLOY", panelDeployName, true);
                } else {
                  setEvent(selectedDate, "DEPLOY", panelDeployName || "Deploy", false);
                }
              }}
              className="rounded"
            />
            <label htmlFor="panel-deploy" className="text-xs text-white/60 w-28">Deployment</label>
            <input
              type="text"
              value={panelDeployName}
              onChange={(e) => setPanelDeployName(e.target.value)}
              onBlur={() => {
                if (panelDeploy) setEvent(selectedDate, "DEPLOY", panelDeployName || "Deploy", false);
              }}
              disabled={!panelDeploy}
              placeholder="Deploy note (optional)"
              className="flex-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-white/20 focus:border-violet-500 focus:outline-none disabled:opacity-30"
            />
          </div>

          {/* On leave */}
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-widest font-medium mb-2">On leave</p>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => {
                const onLeave = leaveMap[m.id]?.has(selectedDate) ?? false;
                return (
                  <button
                    key={m.id}
                    onClick={() => toggleLeave(m.id, selectedDate)}
                    title={`${m.name} — ${onLeave ? "Remove leave" : "Mark on leave"}`}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-full border transition-all text-xs ${
                      onLeave
                        ? "border-amber-500/60 bg-amber-500/20 text-amber-300"
                        : "border-white/10 bg-white/5 text-white/40 hover:border-white/20 hover:text-white/60"
                    }`}
                  >
                    <MemberAvatar name={m.name} role={m.role} size={16} />
                    <span>{m.name.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
