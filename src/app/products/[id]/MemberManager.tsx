"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MemberAvatar } from "@/components/session/MemberAvatar";
import { RoleBadge } from "@/components/session/RoleBadge";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const ROLES = ["DEV", "QA", "UI_UX", "SM", "TECH_LEAD"];

type Member = { id: string; name: string; role: string; capacity: number; country?: string | null };

export function MemberManager({ productId, initialMembers }: { productId: string; initialMembers: Member[] }) {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("DEV");
  const [editCountry, setEditCountry] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("DEV");
  const [newCountry, setNewCountry] = useState("");
  const [busy, setBusy] = useState(false);

  const startEdit = (m: Member) => {
    setEditId(m.id);
    setEditName(m.name);
    setEditRole(m.role);
    setEditCountry(m.country ?? "");
    setAdding(false);
  };

  const saveEdit = async () => {
    if (!editId || !editName.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/products/${productId}/members/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim(), role: editRole, country: editCountry || null }),
    });
    if (res.ok) {
      const updated = await res.json();
      setMembers((ms) => ms.map((m) => m.id === editId ? updated : m));
      setEditId(null);
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
    <div className="space-y-1.5">
      {members.map((m) => (
        <div key={m.id} className="group rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 flex items-center gap-3">
          {editId === m.id ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                className="flex-1 bg-white/8 border border-white/15 rounded-lg px-2.5 py-1 text-sm text-white focus:border-violet-500 focus:outline-none"
                autoFocus
              />
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                className="bg-white/8 border border-white/15 rounded-lg px-2 py-1 text-xs text-white focus:border-violet-500 focus:outline-none"
              >
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <input
                value={editCountry}
                onChange={(e) => setEditCountry(e.target.value)}
                placeholder="Country (MY, SG…)"
                className="w-20 bg-white/8 border border-white/15 rounded-lg px-2 py-1 text-xs text-white focus:border-violet-500 focus:outline-none"
              />
              <button onClick={saveEdit} disabled={busy} className="p-1 rounded text-emerald-400 hover:bg-emerald-500/15"><Check className="w-4 h-4" /></button>
              <button onClick={() => setEditId(null)} className="p-1 rounded text-white/30 hover:bg-white/8"><X className="w-4 h-4" /></button>
            </div>
          ) : deleteId === m.id ? (
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
          <input
            value={newCountry}
            onChange={(e) => setNewCountry(e.target.value)}
            placeholder="Country (MY, SG…)"
            className="w-20 bg-white/8 border border-white/15 rounded-lg px-2 py-1 text-xs text-white focus:border-violet-500 focus:outline-none"
          />
          <button onClick={addMember} disabled={busy || !newName.trim()} className="p-1 rounded text-emerald-400 hover:bg-emerald-500/15 disabled:opacity-30"><Check className="w-4 h-4" /></button>
          <button onClick={() => setAdding(false)} className="p-1 rounded text-white/30 hover:bg-white/8"><X className="w-4 h-4" /></button>
        </div>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => { setAdding(true); setEditId(null); }} className="w-full border border-dashed border-white/15 hover:border-violet-500/40">
          <Plus className="w-3.5 h-3.5" />
          Add member
        </Button>
      )}
    </div>
  );
}
