"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MemberAvatar } from "@/components/session/MemberAvatar";
import { RoleBadge } from "@/components/session/RoleBadge";
import { getRoleColor } from "@/lib/roles";
import { Pencil, Trash2, Plus, X } from "lucide-react";

const ROLES = ["DEV", "QA", "UI_UX", "SM", "TECH_LEAD"];

const COUNTRIES = [
  { value: "", label: "— Not set —" },
  { value: "MY", label: "Malaysia (MY)" },
  { value: "SG", label: "Singapore (SG)" },
  { value: "VN", label: "Vietnam (VN)" },
  { value: "ID", label: "Indonesia (ID)" },
  { value: "PH", label: "Philippines (PH)" },
  { value: "TH", label: "Thailand (TH)" },
  { value: "IN", label: "India (IN)" },
  { value: "AU", label: "Australia (AU)" },
  { value: "GB", label: "United Kingdom (GB)" },
  { value: "US", label: "United States (US)" },
];

type Member = { id: string; name: string; role: string; capacity: number; country?: string | null };

const inputCls = "w-full bg-white/5 border border-white/12 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-violet-500/60 focus:outline-none transition-colors";
const selectCls = "w-full bg-white/5 border border-white/12 rounded-xl px-3 py-2.5 text-sm text-white focus:border-violet-500/60 focus:outline-none transition-colors";

// Capacity bar — shows sprint load capacity as a visual bar
function CapacityBar({ capacity }: { capacity: number }) {
  const max = 40;
  const pct = Math.min(100, Math.round((capacity / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <div style={{ width: 48, height: 3, background: "#ffffff0a", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#7c3aed88,#a78bfaaa)", borderRadius: 2 }} />
      </div>
      <span className="text-[10px] font-mono text-white/25">{capacity} SP</span>
    </div>
  );
}

// Group members by role for visual separation
function groupByRole(members: Member[]): { role: string; members: Member[] }[] {
  const order = ["TECH_LEAD", "DEV", "QA", "UI_UX", "SM"];
  const map = new Map<string, Member[]>();
  for (const m of members) {
    const r = m.role;
    if (!map.has(r)) map.set(r, []);
    map.get(r)!.push(m);
  }
  return order
    .filter((r) => map.has(r))
    .map((r) => ({ role: r, members: map.get(r)! }));
}

function MemberRow({ m, onEdit, onDelete }: { m: Member; onEdit: () => void; onDelete: () => void }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const { hex } = getRoleColor(m.role);

  if (confirmDel) {
    return (
      <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl border border-red-500/20 bg-red-500/5">
        <span className="text-sm text-white/50 flex-1">Remove <span className="text-white font-medium">{m.name}</span>?</span>
        <button onClick={onDelete} className="text-xs px-3 py-1 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30">Remove</button>
        <button onClick={() => setConfirmDel(false)} className="text-xs px-3 py-1 rounded-lg bg-white/8 text-white/40 hover:bg-white/12">Cancel</button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-white/[0.03] transition-colors cursor-default">
      <MemberAvatar name={m.name} role={m.role} size={34} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-white truncate">{m.name}</p>
          {m.country && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-white/30 shrink-0">{m.country}</span>
          )}
        </div>
        <CapacityBar capacity={m.capacity ?? 20} />
      </div>
      <RoleBadge role={m.role} size="sm" />
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-white/8 text-white/25 hover:text-white/70 transition-colors">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setConfirmDel(true)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/25 hover:text-red-400 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function MemberManager({ productId, initialMembers }: { productId: string; initialMembers: Member[] }) {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("DEV");
  const [editCountry, setEditCountry] = useState("");
  const [editCapacity, setEditCapacity] = useState(20);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("DEV");
  const [newCountry, setNewCountry] = useState("");
  const [busy, setBusy] = useState(false);

  const startEdit = (m: Member) => {
    setEditMember(m);
    setEditName(m.name);
    setEditRole(m.role);
    setEditCountry(m.country ?? "");
    setEditCapacity(m.capacity ?? 20);
    setAdding(false);
  };

  const closeModal = () => setEditMember(null);

  const saveEdit = async () => {
    if (!editMember || !editName.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/products/${productId}/members/${editMember.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim(), role: editRole, country: editCountry || null, capacity: editCapacity }),
    });
    if (res.ok) {
      const updated = await res.json();
      setMembers((ms) => ms.map((m) => m.id === editMember.id ? updated : m));
      closeModal();
    }
    setBusy(false);
  };

  const confirmDelete = async (memberId: string) => {
    setBusy(true);
    await fetch(`/api/products/${productId}/members/${memberId}`, { method: "DELETE" });
    setMembers((ms) => ms.filter((m) => m.id !== memberId));
    setBusy(false);
    router.refresh();
  };

  const addMember = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/products/${productId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), role: newRole, country: newCountry || null }),
    });
    if (res.ok) {
      const created = await res.json();
      setMembers((ms) => [...ms, created]);
      setNewName("");
      setNewRole("DEV");
      setNewCountry("");
      setAdding(false);
    }
    setBusy(false);
  };

  const groups = groupByRole(members);

  return (
    <>
      <div className="space-y-5">
        {/* Member groups */}
        {groups.map(({ role, members: roleMembers }) => {
          const { hex } = getRoleColor(role);
          return (
            <div key={role}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: hex, boxShadow: `0 0 6px ${hex}88` }} />
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: hex + "99" }}>
                  {role.replace("_", " ")}
                </span>
                <span className="text-[10px] text-white/15">{roleMembers.length}</span>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden divide-y divide-white/5">
                {roleMembers.map((m) => (
                  <MemberRow key={m.id} m={m} onEdit={() => startEdit(m)} onDelete={() => confirmDelete(m.id)} />
                ))}
              </div>
            </div>
          );
        })}

        {/* Add member row */}
        {adding ? (
          <div className="rounded-2xl border border-violet-500/25 bg-violet-600/5 p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-violet-400/60">New member</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addMember()}
                placeholder="Full name"
                autoFocus
                className={inputCls}
              />
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className={selectCls}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select value={newCountry} onChange={(e) => setNewCountry(e.target.value)} className={selectCls}>
                {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setAdding(false)} className="px-3 py-1.5 rounded-lg text-sm text-white/40 hover:text-white/70 hover:bg-white/8 transition-colors">
                Cancel
              </button>
              <button
                onClick={addMember}
                disabled={busy || !newName.trim()}
                className="px-4 py-1.5 rounded-lg text-sm bg-violet-600 hover:bg-violet-500 text-white font-semibold disabled:opacity-40 transition-colors"
              >
                {busy ? "Adding…" : "Add member"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-white/10 text-white/30 hover:border-violet-500/40 hover:text-violet-400 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" /> Add member
          </button>
        )}
      </div>

      {/* Edit slide-in panel */}
      <AnimatePresence>
        {editMember && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              key="panel"
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-[#0d0b1a] border-l border-white/10 flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-3">
                  <MemberAvatar name={editName || editMember.name} role={editRole} size={32} />
                  <h2 className="text-white font-semibold text-sm">Edit Member</h2>
                </div>
                <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white/70">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
                <div>
                  <label className="block text-[10px] text-white/30 uppercase tracking-widest mb-1.5">Name</label>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveEdit()} autoFocus className={inputCls} />
                </div>

                <div>
                  <label className="block text-[10px] text-white/30 uppercase tracking-widest mb-1.5">Role</label>
                  <div className="grid grid-cols-3 gap-2">
                    {ROLES.map((r) => {
                      const { hex } = getRoleColor(r);
                      return (
                        <button
                          key={r}
                          onClick={() => setEditRole(r)}
                          className="py-2 rounded-xl text-xs font-semibold border transition-all"
                          style={editRole === r
                            ? { background: hex + "22", borderColor: hex + "88", color: hex }
                            : { background: "transparent", borderColor: "#ffffff12", color: "#ffffff30" }
                          }
                        >
                          {r.replace("_", " ")}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-white/30 uppercase tracking-widest mb-1.5">Country</label>
                  <select value={editCountry} onChange={(e) => setEditCountry(e.target.value)} className={selectCls}>
                    {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-white/30 uppercase tracking-widest mb-1.5">
                    Sprint capacity — <span className="text-violet-400 font-mono">{editCapacity} SP</span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={60}
                    value={editCapacity}
                    onChange={(e) => setEditCapacity(parseInt(e.target.value, 10))}
                    className="w-full accent-violet-500"
                  />
                  <div className="flex justify-between text-[10px] text-white/20 mt-1">
                    <span>1</span><span>20</span><span>40</span><span>60</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/10 shrink-0">
                <button onClick={closeModal} className="px-4 py-2 rounded-xl text-sm text-white/40 hover:text-white/70 hover:bg-white/8 transition-colors">Cancel</button>
                <button
                  onClick={saveEdit}
                  disabled={busy || !editName.trim()}
                  className="px-5 py-2 rounded-xl text-sm bg-violet-600 hover:bg-violet-500 text-white font-semibold disabled:opacity-40 transition-colors"
                >
                  {busy ? "Saving…" : "Save"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
