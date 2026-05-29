"use client";
import { MemberAvatar } from "./MemberAvatar";
import type { CheckedInMember } from "@/types/partykit";

interface AssignmentPickerProps {
  members: CheckedInMember[];
  selectedMemberId: string | null;
  onChange: (id: string | null) => void;
}

export function AssignmentPicker({ members, selectedMemberId, onChange }: AssignmentPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Assign to</p>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => onChange(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
            selectedMemberId === null
              ? "border-white/30 bg-white/10 text-white"
              : "border-white/10 bg-transparent text-white/40 hover:text-white/70"
          }`}
        >
          No assignee
        </button>
        {members.map((m) => (
          <button
            key={m.memberId}
            onClick={() => onChange(selectedMemberId === m.memberId ? null : m.memberId)}
            className="flex flex-col items-center gap-1 group"
            title={m.memberName}
          >
            <div
              className="transition-transform group-hover:scale-110"
              style={{
                outline: selectedMemberId === m.memberId ? "2px solid #8b5cf6" : "2px solid transparent",
                outlineOffset: 2,
                borderRadius: "50%",
              }}
            >
              <MemberAvatar
                name={m.memberName}
                role={m.role}
                size={36}
                showRing={selectedMemberId === m.memberId}
              />
            </div>
            <span className="text-[10px] text-white/50 group-hover:text-white/80 max-w-[48px] truncate">
              {m.memberName.split(" ")[0]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
