"use client";
import { useState, useEffect } from "react";
import type { Member } from "@/types/models";
import type { CheckedInMember } from "@/types/partykit";
import { MemberAvatar } from "./MemberAvatar";
import { Globe, CalendarX, SunDim } from "lucide-react";

interface PublicHoliday {
  date: string; // YYYY-MM-DD
  name: string;
}

interface SprintCalendarProps {
  sessionId: string;
  startDate: Date | null;
  endDate: Date | null;
  members: Member[];
  checkedIn: CheckedInMember[];
  countryCode?: string;
  mode?: "planning" | "active";
}

const COUNTRY_OPTIONS = [
  { code: "MY", label: "MY" },
  { code: "VN", label: "VN" },
  { code: "SG", label: "SG" },
  { code: "US", label: "US" },
  { code: "GB", label: "GB" },
  { code: "AU", label: "AU" },
];

const DAY_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

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

function formatDateRange(dates: string[]): { label: string; count: number }[] {
  if (dates.length === 0) return [];
  const sorted = [...dates].sort();
  const groups: { start: string; end: string; count: number }[] = [];
  let start = sorted[0], prev = sorted[0], count = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prevDate = new Date(prev);
    prevDate.setDate(prevDate.getDate() + 1);
    if (sorted[i] === isoDate(prevDate)) {
      prev = sorted[i];
      count++;
    } else {
      groups.push({ start, end: prev, count });
      start = prev = sorted[i];
      count = 1;
    }
  }
  groups.push({ start, end: prev, count });

  return groups.map(({ start, end, count }) => {
    const s = new Date(start);
    const e = new Date(end);
    const sm = MONTH_SHORT[s.getMonth()];
    const em = MONTH_SHORT[e.getMonth()];
    const label = start === end
      ? `${s.getDate()} ${sm}`
      : sm === em
      ? `${s.getDate()}–${e.getDate()} ${sm}`
      : `${s.getDate()} ${sm} – ${e.getDate()} ${em}`;
    return { label, count };
  });
}

export function SprintCalendar({
  sessionId,
  startDate,
  endDate,
  members,
  checkedIn,
  countryCode: defaultCountry = "MY",
  mode = "planning",
}: SprintCalendarProps) {
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [holidayNames, setHolidayNames] = useState<Record<string, string>>({});
  const [leaveMap, setLeaveMap] = useState<Record<string, Set<string>>>({});
  const [selectedCountry, setSelectedCountry] = useState(defaultCountry);
  const [loadingHolidays, setLoadingHolidays] = useState(false);

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

  const persistHolidays = (set: Set<string>, names: Record<string, string>) => {
    const list = [...set].map((d) => ({ date: d, name: names[d] ?? "Public Holiday" }));
    fetch(`/api/sessions/${sessionId}/holidays`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holidays: list }),
    }).catch(() => {});
  };

  const applyHolidays = (list: PublicHoliday[]) => {
    const set = new Set(list.map((h) => h.date));
    const names: Record<string, string> = {};
    for (const h of list) names[h.date] = h.name;
    setHolidays(set);
    setHolidayNames(names);
  };

  useEffect(() => {
    if (!startDate) return;
    fetch(`/api/sessions/${sessionId}/holidays`)
      .then((r) => r.json())
      .then((data: { holidays: PublicHoliday[] }) => {
        if (data.holidays.length > 0) {
          applyHolidays(data.holidays);
        } else {
          const year = startDate.getFullYear();
          fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${selectedCountry}`)
            .then((r) => r.json())
            .then((list: PublicHoliday[]) => {
              applyHolidays(list);
              persistHolidays(new Set(list.map((h) => h.date)), Object.fromEntries(list.map((h) => [h.date, h.name])));
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, startDate]);

  const handleCountryChange = (code: string) => {
    setSelectedCountry(code);
    if (!startDate) return;
    setLoadingHolidays(true);
    const year = startDate.getFullYear();
    fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${code}`)
      .then((r) => r.json())
      .then((list: PublicHoliday[]) => {
        applyHolidays(list);
        persistHolidays(new Set(list.map((h) => h.date)), Object.fromEntries(list.map((h) => [h.date, h.name])));
      })
      .catch(() => {})
      .finally(() => setLoadingHolidays(false));
  };

  // Toggle a single date as public holiday (manual, in planning mode)
  const toggleHoliday = (dateStr: string) => {
    setHolidays((prev) => {
      const next = new Set(prev);
      const nextNames = { ...holidayNames };
      if (next.has(dateStr)) {
        next.delete(dateStr);
        delete nextNames[dateStr];
      } else {
        next.add(dateStr);
        nextNames[dateStr] = "Public Holiday";
      }
      setHolidayNames(nextNames);
      persistHolidays(next, nextNames);
      return next;
    });
  };

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

  const workingDays = days.filter((d) => !isWeekend(d) && !holidays.has(isoDate(d)));
  const totalLeave = members.reduce((acc, m) => acc + (leaveMap[m.id]?.size ?? 0), 0);
  const totalCapacity = workingDays.length * members.length - totalLeave;

  // ── ACTIVE MODE: compact summary ────────────────────────────────────────────
  if (mode === "active") {
    const membersOnLeave = members
      .map((m) => {
        const leaveDates = [...(leaveMap[m.id] ?? new Set<string>())].filter((d) => {
          const date = new Date(d);
          return !isWeekend(date) && !holidays.has(d);
        });
        return { member: m, leaveDates };
      })
      .filter(({ leaveDates }) => leaveDates.length > 0);

    const phDates = days
      .filter((d) => holidays.has(isoDate(d)))
      .map((d) => ({ date: isoDate(d), name: holidayNames[isoDate(d)] ?? "Public Holiday" }));

    const hasAnything = membersOnLeave.length > 0 || phDates.length > 0;

    return (
      <div className="flex gap-8 text-xs">
        {/* Capacity summary */}
        <div className="shrink-0 text-white/30 space-y-0.5">
          <p className="text-white/50 font-medium mb-1">Sprint capacity</p>
          <p>{workingDays.length} working days</p>
          <p className="text-emerald-400 font-semibold">{totalCapacity} capacity days</p>
        </div>

        {/* Members on leave */}
        <div className="flex-1 min-w-0">
          <p className="text-white/40 font-medium mb-2 flex items-center gap-1.5">
            <CalendarX className="w-3 h-3" /> Leave
          </p>
          {membersOnLeave.length === 0 ? (
            <p className="text-white/20 italic">No leave marked</p>
          ) : (
            <div className="space-y-1">
              {membersOnLeave.map(({ member, leaveDates }) => {
                const ranges = formatDateRange(leaveDates);
                const isIn = checkedIn.some((c) => c.memberId === member.id);
                return (
                  <div key={member.id} className={`flex items-center gap-2 ${!isIn ? "opacity-40" : ""}`}>
                    <MemberAvatar name={member.name} role={member.role} size={16} />
                    <span className="text-white/60 font-medium">{member.name.split(" ")[0]}</span>
                    <span className="text-white/25">—</span>
                    {ranges.map((r, i) => (
                      <span key={i} className="text-amber-400/80">
                        {r.label} <span className="text-white/30">({r.count}d)</span>
                        {i < ranges.length - 1 && <span className="text-white/20">, </span>}
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Public holidays */}
        <div className="shrink-0">
          <p className="text-white/40 font-medium mb-2 flex items-center gap-1.5">
            <SunDim className="w-3 h-3" /> Public Holidays
          </p>
          {phDates.length === 0 ? (
            <p className="text-white/20 italic">None in sprint</p>
          ) : (
            <div className="space-y-1">
              {phDates.map(({ date, name }) => {
                const d = new Date(date);
                return (
                  <div key={date} className="flex items-center gap-2">
                    <span className="text-red-400/80 font-medium">
                      {d.getDate()} {MONTH_SHORT[d.getMonth()]}
                    </span>
                    <span className="text-white/30">—</span>
                    <span className="text-white/50">{name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── PLANNING MODE: full calendar grid ────────────────────────────────────────
  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-white/50 font-medium">Sprint Calendar</span>
          <span className="text-white/20">·</span>
          <span className="text-white/35">{workingDays.length} working days</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Globe className="w-3 h-3 text-white/25" />
          <span className="text-[10px] text-white/30">Load PH from:</span>
          <div className="flex gap-0.5">
            {COUNTRY_OPTIONS.map((c) => (
              <button
                key={c.code}
                onClick={() => handleCountryChange(c.code)}
                disabled={loadingHolidays}
                className={`text-[10px] px-2 py-0.5 rounded transition-all font-mono ${
                  selectedCountry === c.code
                    ? "bg-violet-600/60 text-white border border-violet-500/50"
                    : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white/60"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          {loadingHolidays && <span className="text-[10px] text-white/30 animate-pulse ml-1">loading...</span>}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-white/25 mb-2">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/40 inline-block" /> Workday</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-white/8 inline-block" /> Weekend</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500/50 inline-block" /> Public holiday <span className="italic text-white/15 ml-0.5">(click date to toggle)</span></span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500/50 inline-block" /> On leave <span className="italic text-white/15 ml-0.5">(click cell to toggle)</span></span>
      </div>

      {/* Scrollable grid */}
      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* Day headers — clickable to toggle PH */}
          <div className="flex gap-px mb-0.5 ml-[92px]">
            {days.map((d) => {
              const ds = isoDate(d);
              const isHol = holidays.has(ds);
              const isWknd = isWeekend(d);
              const isFirst = ds === isoDate(days[0]);
              const canToggle = !isWknd;
              return (
                <button
                  key={ds}
                  disabled={isWknd}
                  onClick={() => canToggle && toggleHoliday(ds)}
                  title={
                    isWknd ? undefined :
                    isHol ? `${holidayNames[ds] ?? "Public Holiday"} — click to remove` :
                    "Click to mark as public holiday"
                  }
                  className={`w-8 text-center leading-none py-1 rounded-t-sm transition-colors group ${
                    isHol ? "bg-red-500/25 text-red-400" :
                    isWknd ? "text-white/15 cursor-default" :
                    "text-white/35 hover:bg-white/8 cursor-pointer"
                  }`}
                >
                  <div className="text-[9px] font-semibold">{d.getDate()}</div>
                  <div className="text-[7px] opacity-70 mt-0.5">{DAY_SHORT[d.getDay()]}</div>
                  {(d.getDate() === 1 || isFirst) && (
                    <div className="text-[7px] text-violet-400/60 mt-0.5">{MONTH_SHORT[d.getMonth()]}</div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Member rows */}
          {members.map((m) => {
            const isIn = checkedIn.some((c) => c.memberId === m.id);
            const memberLeave = leaveMap[m.id] ?? new Set<string>();
            const leaveCount = memberLeave.size;
            return (
              <div key={m.id} className="flex gap-px mb-px items-center">
                <div className={`w-[92px] shrink-0 flex items-center gap-1.5 pr-2 ${!isIn ? "opacity-35" : ""}`}>
                  <MemberAvatar name={m.name} role={m.role} size={18} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-white/60 truncate leading-none">{m.name.split(" ")[0]}</p>
                    {leaveCount > 0 && (
                      <p className="text-[8px] text-amber-400/60 leading-none mt-0.5">-{leaveCount}d</p>
                    )}
                  </div>
                </div>
                {days.map((d) => {
                  const ds = isoDate(d);
                  const isHol = holidays.has(ds);
                  const isWknd = isWeekend(d);
                  const isLeave = memberLeave.has(ds);
                  const isWork = !isHol && !isWknd;

                  return (
                    <button
                      key={ds}
                      onClick={() => isWork && toggleLeave(m.id, ds)}
                      disabled={!isWork}
                      title={
                        isHol ? holidayNames[ds] :
                        isLeave ? `${m.name.split(" ")[0]} on leave — click to remove` :
                        isWork ? `Mark ${m.name.split(" ")[0]} on leave` : undefined
                      }
                      className={`w-8 h-7 rounded-sm transition-colors ${
                        isLeave ? "bg-amber-500/45 hover:bg-amber-500/65 cursor-pointer" :
                        isHol   ? "bg-red-500/25 cursor-default" :
                        isWknd  ? "bg-white/5 cursor-default" :
                                  "bg-emerald-500/15 hover:bg-emerald-500/30 cursor-pointer"
                      }`}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
