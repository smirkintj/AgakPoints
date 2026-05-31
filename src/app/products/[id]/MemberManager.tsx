"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MemberAvatar } from "@/components/session/MemberAvatar";
import { RoleBadge } from "@/components/session/RoleBadge";
import { Pencil, Trash2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

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

export function MemberManager({ productId, initialMembers }: { productId: string; initialMembers: Member[] }) {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("DEV");
  const [editCountry, setEditCountry] = useState("");
  const [editCapacity, setEditCapacity] = useState(20);
  const [deleteId, setDeleteId] = useState<string | null>(null);
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
      body: JSON.stringify({
        name: editName.trim(),
        role: editRole,
        country: editCountry || null,
        capacity: editCapacity,
      }),
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
    setDeleteId(null);
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

  return (
    <>
      <div className="space-y-1.5">
        {members.map((m) => (
          <div key={m.id} className="group rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 flex items-center gap-3">
            {deleteId === m.id ? (
              <div className="flex items-center gap-2 flex-1">
                <span className="text-sm text-white/50 flex-1">Remove <span className="text-white font-medium">{m.name}</span>?</span>
                <button onClick={() => confirmDelete(m.id)} disabled={busy} className="text-xs px-2.5 py-1 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30">Remove</button>
                <button onClick={() => setDeleteId(null)} className="text-xs px-2.5 py-1 rounded-lg bg-white/8 text-white/40 hover:bg-white/12">Cancel</button>
              </div>
            ) : (
              <>
                <MemberAvatar name={m.name} role={m.role} size={32} />
                <span className="text-white text-sm font-medium flex-1 truncate">{m.name}</span>
                {m.country && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-white/40 border border-white/10">{m.country}</span>}
                <RoleBadge role={m.role} size="sm" />
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(m)} className="p-1.5 rounded-lg hover:bg-white/8 text-white/30 hover:text-white/70"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setDeleteId(m.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </>
            )}
          </div>
        ))}

        {adding ? (
          <div className="rounded-xl border border-violet-500/30 bg-violet-600/8 px-3 py-2.5 flex items-center gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMember()}
              placeholder="Member name"
              className="flex-1 bg-white/8 border border-white/15 rounded-lg px-2.5 py-1 text-sm text-white placeholder:text-white/25 focus:border-violet-500 focus:outline-none"
              autoFocus
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="bg-white/8 border border-white/15 rounded-lg px-2 py-1 text-xs text-white focus:border-violet-500 focus:outline-none"
            >
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select
              value={newCountry}
              onChange={(e) => setNewCountry(e.target.value)}
              className="bg-white/8 border border-white/15 rounded-lg px-2 py-1 text-xs text-white focus:border-violet-500 focus:outline-none"
            >
              {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <button onClick={addMember} disabled={busy || !newName.trim()} className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-30">Add</button>
            <button onClick={() => setAdding(false)} className="p-1 rounded text-white/30 hover:bg-white/8"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => { setAdding(true); }} className="w-full border border-dashed border-white/15 hover:border-violet-500/40">
            <Plus className="w-3.5 h-3.5" />
            Add member
          </Button>
        )}
      </div>

      {/* Edit modal */}
      <AnimatePresence>
        {editMember && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            {/* Slide-in panel */}
            <motion.div
              key="panel"
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-[#0d0b1a] border-l border-white/10 flex flex-col shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
                <h2 className="text-white font-semibold text-base">Edit Member</h2>
                <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white/70">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
                {/* Name */}
                <div>
                  <label className="block text-xs text-white/40 uppercase tracking-widest mb-1.5">Name</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-violet-500 focus:outline-none"
                    autoFocus
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-xs text-white/40 uppercase tracking-widest mb-1.5">Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>

                {/* Country */}
                <div>
                  <label className="block text-xs text-white/40 uppercase tracking-widest mb-1.5">Country</label>
                  <select
                    value={editCountry}
                    onChange={(e) => setEditCountry(e.target.value)}
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                  >
                    {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>

                {/* Capacity */}
                <div>
                  <label className="block text-xs text-white/40 uppercase tracking-widest mb-1.5">Capacity (story points per sprint)</label>
                  <input
                    type="number"
                    min={1}
                    value={editCapacity}
                    onChange={(e) => setEditCapacity(parseInt(e.target.value, 10) || 20)}
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/10 shrink-0">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white/80 hover:bg-white/8 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={busy || !editName.trim()}
                  className="px-4 py-2 rounded-lg text-sm bg-violet-600 hover:bg-violet-500 text-white font-medium disabled:opacity-40 transition-colors"
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
