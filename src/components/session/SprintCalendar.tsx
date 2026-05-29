"use client";
import { useState, useEffect } from "react";
import type { Member } from "@/types/models";
import type { CheckedInMember } from "@/types/partykit";
import { MemberAvatar } from "./MemberAvatar";

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
  { code: "MY", label: "MY" },
  { code: "SG", label: "SG" },
  { code: "US", label: "US" },
  { code: "GB", label: "GB" },
];

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

export function SprintCalendar({ sessionId, startDate, endDate, members, checkedIn, countryCode: defaultCountry = "MY" }: SprintCalendarProps) {
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [holidayNames, setHolidayNames] = useState<Record<string, string>>({});
  const [leaveMap, setLeaveMap] = useState<Record<string, Set<string>>>({}); // memberId → set of ISO dates on leave
  const [selectedCountry, setSelectedCountry] = useState(defaultCountry);

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

  // Load or fetch holidays
  useEffect(() => {
    if (!startDate) return;

    const applyHolidays = (list: PublicHoliday[]) => {
      const set = new Set(list.map((h) => h.date));
      const names: Record<string, string> = {};
      for (const h of list) names[h.date] = h.name;
      setHolidays(set);
      setHolidayNames(names);
    };

    // First try DB
    fetch(`/api/sessions/${sessionId}/holidays`)
      .then((r) => r.json())
      .then((data: { holidays: PublicHoliday[] }) => {
        if (data.holidays.length > 0) {
          applyHolidays(data.holidays);
        } else {
          // Fetch from nager.at and persist
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

  // When country changes, re-fetch from nager.at and update DB
  const handleCountryChange = (code: string) => {
    setSelectedCountry(code);
    if (!startDate) return;
    const year = startDate.getFullYear();
    fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${code}`)
      .then((r) => r.json())
      .then((list: PublicHoliday[]) => {
        const set = new Set(list.map((h) => h.date));
        const names: Record<string, string> = {};
        for (const h of list) names[h.date] = h.name;
        setHolidays(set);
        setHolidayNames(names);
        fetch(`/api/sessions/${sessionId}/holidays`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ holidays: list }),
        }).catch(() => {});
      })
      .catch(() => {});
  };

  if (!startDate || !endDate) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 text-center text-xs text-white/30 py-6">
        No sprint dates set for this session. Sprint dates are fetched from JIRA when creating a session.
      </div>
    );
  }

  // Build array of all days in sprint
  const days: Date[] = [];
  let cur = new Date(startDate);
  const end = new Date(endDate);
  while (cur <= end) {
    days.push(new Date(cur));
    cur = addDays(cur, 1);
  }

  const workingDays = days.filter((d) => !isWeekend(d) && !holidays.has(isoDate(d)));

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

  // Capacity calculation
  const totalLeave = members.reduce((acc, m) => acc + (leaveMap[m.id]?.size ?? 0), 0);
  const totalCapacity = workingDays.length * members.length - totalLeave;

  // Group days into weeks
  const weeks: Date[][] = [];
  let week: Date[] = [];
  for (const d of days) {
    week.push(d);
    if (d.getDay() === 0 || d === days[days.length - 1]) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) weeks.push(week);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-white/40 font-medium uppercase tracking-widest">Sprint Calendar</p>
        <div className="flex items-center gap-3">
          <select
            value={selectedCountry}
            onChange={(e) => handleCountryChange(e.target.value)}
            className="text-[10px] bg-white/5 border border-white/15 rounded px-1.5 py-0.5 text-white/50 focus:outline-none focus:border-white/30"
          >
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-3 text-[10px] text-white/30">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/50 inline-block" /> Workday</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-white/10 inline-block" /> Weekend</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500/50 inline-block" /> Holiday</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-500/50 inline-block" /> Leave</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3 text-xs text-white/40">
        <span>{startDate.toLocaleDateString()} → {endDate.toLocaleDateString()}</span>
        <span className="text-white/20">·</span>
        <span>{workingDays.length} working days</span>
        <span className="text-white/20">·</span>
        <span className="text-emerald-400">{totalCapacity} capacity days total</span>
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* Day headers */}
          <div className="flex gap-px mb-1">
            <div className="w-24 shrink-0" />
            {days.map((d) => {
              const ds = isoDate(d);
              const isHol = holidays.has(ds);
              const isWknd = isWeekend(d);
              return (
                <div
                  key={ds}
                  title={isHol ? holidayNames[ds] : undefined}
                  className={`w-7 h-7 flex flex-col items-center justify-center rounded-sm text-[8px] leading-none ${
                    isHol ? "bg-red-500/20 text-red-400" :
                    isWknd ? "bg-white/5 text-white/15" :
                    "bg-emerald-500/15 text-white/40"
                  }`}
                >
                  <span className="font-semibold">{d.getDate()}</span>
                  <span className="opacity-60">{["Su","Mo","Tu","We","Th","Fr","Sa"][d.getDay()]}</span>
                </div>
              );
            })}
          </div>

          {/* Member rows */}
          {members.map((m) => {
            const isIn = checkedIn.some((c) => c.memberId === m.id);
            const memberLeave = leaveMap[m.id] ?? new Set<string>();
            return (
              <div key={m.id} className="flex gap-px mb-px items-center">
                <div className={`w-24 shrink-0 flex items-center gap-1.5 pr-2 ${!isIn ? "opacity-40" : ""}`}>
                  <MemberAvatar name={m.name} role={m.role} size={18} />
                  <span className="text-[10px] text-white/60 truncate">{m.name.split(" ")[0]}</span>
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
                      title={isLeave ? "Leave (click to remove)" : isWork ? "Click to mark leave" : undefined}
                      className={`w-7 h-7 rounded-sm transition-colors ${
                        isLeave ? "bg-yellow-500/40 hover:bg-yellow-500/60" :
                        isHol ? "bg-red-500/15 cursor-default" :
                        isWknd ? "bg-white/5 cursor-default" :
                        "bg-emerald-500/10 hover:bg-emerald-500/25"
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
