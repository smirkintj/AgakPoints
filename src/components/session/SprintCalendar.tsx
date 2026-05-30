"use client";
import { useState, useEffect } from "react";
import type { Member } from "@/types/models";
import type { CheckedInMember } from "@/types/partykit";
import { MemberAvatar } from "./MemberAvatar";
import { Globe } from "lucide-react";

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
}

const COUNTRY_OPTIONS = [
  { code: "MY", label: "🇲🇾 MY" },
  { code: "VN", label: "🇻🇳 VN" },
  { code: "SG", label: "🇸🇬 SG" },
  { code: "US", label: "🇺🇸 US" },
  { code: "GB", label: "🇬🇧 GB" },
  { code: "AU", label: "🇦🇺 AU" },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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

export function SprintCalendar({
  sessionId,
  startDate,
  endDate,
  members,
  checkedIn,
  countryCode: defaultCountry = "MY",
}: SprintCalendarProps) {
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [holidayNames, setHolidayNames] = useState<Record<string, string>>({});
  const [leaveMap, setLeaveMap] = useState<Record<string, Set<string>>>({});
  const [selectedCountry, setSelectedCountry] = useState(defaultCountry);
  const [loadingHolidays, setLoadingHolidays] = useState(false);

  // Load persisted leaves on mount
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

  const applyHolidays = (list: PublicHoliday[]) => {
    const set = new Set(list.map((h) => h.date));
    const names: Record<string, string> = {};
    for (const h of list) names[h.date] = h.name;
    setHolidays(set);
    setHolidayNames(names);
  };

  // Load or fetch holidays on mount
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
              fetch(`/api/sessions/${sessionId}/holidays`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ holidays: list }),
              }).catch(() => {});
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
        fetch(`/api/sessions/${sessionId}/holidays`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ holidays: list }),
        }).catch(() => {});
      })
      .catch(() => {})
      .finally(() => setLoadingHolidays(false));
  };

  if (!startDate || !endDate) {
    return (
      <div className="text-center text-xs text-white/30 py-4">
        No sprint dates — set them in JIRA when creating the session.
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

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-white/50 font-medium">Sprint Calendar</span>
          <span className="text-white/20">·</span>
          <span className="text-white/35">{workingDays.length} working days</span>
          <span className="text-white/20">·</span>
          <span className="text-emerald-400 font-semibold">{totalCapacity} cap. days</span>
        </div>

        {/* Country selector for public holidays */}
        <div className="flex items-center gap-1.5">
          <Globe className="w-3 h-3 text-white/25" />
          <span className="text-[10px] text-white/30">Public holidays:</span>
          <div className="flex gap-0.5">
            {COUNTRY_OPTIONS.map((c) => (
              <button
                key={c.code}
                onClick={() => handleCountryChange(c.code)}
                disabled={loadingHolidays}
                className={`text-[10px] px-2 py-0.5 rounded transition-all ${
                  selectedCountry === c.code
                    ? "bg-violet-600/60 text-white border border-violet-500/50"
                    : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white/60"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          {loadingHolidays && <span className="text-[10px] text-white/30 animate-pulse ml-1">loading…</span>}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-white/25 mb-2">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/40 inline-block" /> Workday</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-white/8 inline-block" /> Weekend</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500/50 inline-block" /> Public holiday</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500/50 inline-block" /> On leave</span>
        <span className="text-white/15 italic">Click a workday to toggle member leave</span>
      </div>

      {/* Scrollable grid */}
      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* Day headers */}
          <div className="flex gap-px mb-0.5 ml-[92px]">
            {days.map((d) => {
              const ds = isoDate(d);
              const isHol = holidays.has(ds);
              const isWknd = isWeekend(d);
              const isFirst = ds === isoDate(days[0]);
              return (
                <div
                  key={ds}
                  title={isHol ? holidayNames[ds] : undefined}
                  className={`w-8 text-center leading-none py-1 rounded-t-sm ${
                    isHol ? "text-red-400" : isWknd ? "text-white/15" : "text-white/35"
                  }`}
                >
                  <div className="text-[9px] font-semibold">{d.getDate()}</div>
                  <div className="text-[7px] opacity-70 mt-0.5">{DAY_LABELS[d.getDay()].slice(0, 2)}</div>
                  {(d.getDate() === 1 || isFirst) && (
                    <div className="text-[7px] text-violet-400/60 mt-0.5">{MONTH_SHORT[d.getMonth()]}</div>
                  )}
                </div>
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
                      <p className="text-[8px] text-amber-400/60 leading-none mt-0.5">−{leaveCount}d leave</p>
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
                        isHol
                          ? holidayNames[ds]
                          : isLeave
                          ? `${m.name.split(" ")[0]} on leave — click to remove`
                          : isWork
                          ? `Mark ${m.name.split(" ")[0]} on leave`
                          : undefined
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
