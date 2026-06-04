"use client";
import { useState } from "react";
import { X, Check } from "lucide-react";

const DEFAULT_TAG_PRESETS = ["backend", "frontend", "infra", "data-migration", "third-party", "auth", "performance"];
const DEFAULT_DEPENDENCY_TYPES = ["SAP", "Network Team", "Security", "Data", "Payment Gateway", "UI/UX"];

interface ProductSettingsProps {
  productId: string;
  productName: string;
  jiraBaseUrl: string | null;
  jiraProjectKey: string | null;
  jiraEmail: string | null;
  jiraApiToken: string | null;
  jiraBoardId: string | null;
  confluenceBaseUrl: string | null;
  confluenceSpaceKey: string | null;
  confluenceEmail: string | null;
  confluenceToken: string | null;
  tagPresets: string[];
  dependencyTypes: string[];
}

type SectionKey = "general" | "jira" | "confluence" | "tags";

const NAV: { key: SectionKey; label: string; dot?: string }[] = [
  { key: "general", label: "General" },
  { key: "jira", label: "JIRA", dot: "#2684ff" },
  { key: "confluence", label: "Confluence", dot: "#0052cc" },
  { key: "tags", label: "Tags & Deps" },
];

const inputCls = "w-full bg-white/5 border border-white/12 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-violet-500/60 focus:outline-none transition-colors";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div>
        <label className="block text-xs font-semibold text-white/50">{label}</label>
        {hint && <p className="text-[10px] text-white/20 mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function SaveRow({ onSave, saving, extra }: { onSave: () => void; saving: boolean; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-2 pt-2">
      {extra}
      <button
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm bg-violet-600 hover:bg-violet-500 text-white font-semibold disabled:opacity-40 transition-colors"
      >
        {saving ? "Saving…" : <><Check className="w-3.5 h-3.5" /> Save</>}
      </button>
    </div>
  );
}

function TagEditor({ tags, onChange, defaultTags }: { tags: string[]; onChange: (t: string[]) => void; defaultTags: string[] }) {
  const [input, setInput] = useState("");
  const addTag = () => {
    const v = input.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setInput("");
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-white/8 border border-white/12 text-white/60">
            {tag}
            <button onClick={() => onChange(tags.filter((t) => t !== tag))} className="text-white/25 hover:text-white/60">
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTag()}
          placeholder="Add…"
          className="flex-1 bg-white/5 border border-white/12 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-violet-500/60 focus:outline-none"
        />
        <button onClick={addTag} disabled={!input.trim()} className="px-3 py-2 rounded-xl text-xs bg-white/8 border border-white/12 text-white/50 hover:text-white hover:bg-white/12 disabled:opacity-30 transition-colors">
          Add
        </button>
        <button onClick={() => onChange([...defaultTags])} className="px-3 py-2 rounded-xl text-xs bg-white/8 border border-white/12 text-white/30 hover:text-white/60 transition-colors" title="Reset to defaults">
          Reset
        </button>
      </div>
    </div>
  );
}

export function ProductSettings({
  productId, productName,
  jiraBaseUrl: initJiraBaseUrl, jiraProjectKey: initJiraProjectKey,
  jiraEmail: initJiraEmail, jiraApiToken: initJiraApiToken, jiraBoardId: initJiraBoardId,
  confluenceBaseUrl: initConfluenceBaseUrl, confluenceSpaceKey: initConfluenceSpaceKey,
  confluenceEmail: initConfluenceEmail, confluenceToken: initConfluenceToken,
  tagPresets: initTagPresets, dependencyTypes: initDependencyTypes,
}: ProductSettingsProps) {
  const [section, setSection] = useState<SectionKey>("general");

  const [name, setName] = useState(productName);
  const [savingName, setSavingName] = useState(false);

  const [jiraBaseUrl, setJiraBaseUrl] = useState(initJiraBaseUrl ?? "");
  const [jiraProjectKey, setJiraProjectKey] = useState(initJiraProjectKey ?? "");
  const [jiraEmail, setJiraEmail] = useState(initJiraEmail ?? "");
  const [jiraApiToken, setJiraApiToken] = useState(initJiraApiToken ?? "");
  const [jiraBoardId, setJiraBoardId] = useState(initJiraBoardId ?? "");
  const [savingJira, setSavingJira] = useState(false);
  const [jiraTestResult, setJiraTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testingJira, setTestingJira] = useState(false);

  const [confluenceBaseUrl, setConfluenceBaseUrl] = useState(initConfluenceBaseUrl ?? "");
  const [confluenceSpaceKey, setConfluenceSpaceKey] = useState(initConfluenceSpaceKey ?? "");
  const [confluenceEmail, setConfluenceEmail] = useState(initConfluenceEmail ?? "");
  const [confluenceToken, setConfluenceToken] = useState(initConfluenceToken ?? "");
  const [savingConfluence, setSavingConfluence] = useState(false);

  const [tagPresets, setTagPresets] = useState<string[]>(initTagPresets.length > 0 ? initTagPresets : [...DEFAULT_TAG_PRESETS]);
  const [savingTags, setSavingTags] = useState(false);
  const [dependencyTypes, setDependencyTypes] = useState<string[]>(initDependencyTypes.length > 0 ? initDependencyTypes : [...DEFAULT_DEPENDENCY_TYPES]);
  const [savingDeps, setSavingDeps] = useState(false);

  const patch = async (data: Record<string, unknown>) => {
    const res = await fetch(`/api/products/${productId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    return res.ok;
  };

  return (
    <div className="flex gap-6">
      {/* Left nav */}
      <nav className="shrink-0 w-36 space-y-0.5">
        {NAV.map(({ key, label, dot }) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-left transition-colors ${
              section === key ? "bg-white/8 text-white font-semibold" : "text-white/35 hover:text-white/60 hover:bg-white/5"
            }`}
          >
            {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flexShrink: 0, display: "inline-block" }} />}
            {label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0 rounded-2xl border border-white/8 bg-white/[0.02] p-6">

        {section === "general" && (
          <div className="space-y-5">
            <h3 className="text-sm font-bold text-white/70 uppercase tracking-widest">General</h3>
            <Field label="Product name">
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </Field>
            <SaveRow saving={savingName} onSave={async () => { setSavingName(true); await patch({ name }); setSavingName(false); }} />
          </div>
        )}

        {section === "jira" && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2684ff", display: "inline-block" }} />
              <h3 className="text-sm font-bold text-white/70 uppercase tracking-widest">JIRA</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Base URL" hint="e.g. https://yourcompany.atlassian.net">
                <input value={jiraBaseUrl} onChange={(e) => setJiraBaseUrl(e.target.value)} placeholder="https://…" className={inputCls} />
              </Field>
              <Field label="Project key" hint="e.g. PROJ">
                <input value={jiraProjectKey} onChange={(e) => setJiraProjectKey(e.target.value)} placeholder="PROJ" className={inputCls} />
              </Field>
              <Field label="Email">
                <input value={jiraEmail} onChange={(e) => setJiraEmail(e.target.value)} type="email" className={inputCls} />
              </Field>
              <Field label="API token">
                <input value={jiraApiToken} onChange={(e) => setJiraApiToken(e.target.value)} type="password" placeholder="••••••••" className={inputCls} />
              </Field>
              <Field label="Board ID" hint="Numeric board ID from the JIRA URL">
                <input value={jiraBoardId} onChange={(e) => setJiraBoardId(e.target.value)} placeholder="123" className={inputCls} />
              </Field>
            </div>
            {jiraTestResult && (
              <p className={`text-xs ${jiraTestResult.ok ? "text-emerald-400" : "text-red-400"}`}>{jiraTestResult.message}</p>
            )}
            <SaveRow
              saving={savingJira}
              onSave={async () => { setSavingJira(true); await patch({ jiraBaseUrl, jiraProjectKey, jiraEmail, jiraApiToken, jiraBoardId }); setSavingJira(false); }}
              extra={
                <button
                  onClick={async () => { setTestingJira(true); setJiraTestResult(null); const r = await fetch(`/api/products/${productId}/jira-test`); const d = await r.json(); setJiraTestResult(d.ok ? { ok: true, message: `Connected as ${d.displayName}` } : { ok: false, message: d.error }); setTestingJira(false); }}
                  disabled={testingJira}
                  className="px-4 py-2 rounded-xl text-sm bg-white/8 border border-white/12 text-white/50 hover:text-white hover:bg-white/12 disabled:opacity-40 transition-colors"
                >
                  {testingJira ? "Testing…" : "Test connection"}
                </button>
              }
            />
          </div>
        )}

        {section === "confluence" && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0052cc", display: "inline-block" }} />
              <h3 className="text-sm font-bold text-white/70 uppercase tracking-widest">Confluence</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Base URL" hint="e.g. https://yourcompany.atlassian.net/wiki">
                <input value={confluenceBaseUrl} onChange={(e) => setConfluenceBaseUrl(e.target.value)} placeholder="https://…/wiki" className={inputCls} />
              </Field>
              <Field label="Space key" hint="e.g. SPACE">
                <input value={confluenceSpaceKey} onChange={(e) => setConfluenceSpaceKey(e.target.value)} placeholder="SPACE" className={inputCls} />
              </Field>
              <Field label="Email">
                <input value={confluenceEmail} onChange={(e) => setConfluenceEmail(e.target.value)} type="email" className={inputCls} />
              </Field>
              <Field label="API token">
                <input value={confluenceToken} onChange={(e) => setConfluenceToken(e.target.value)} type="password" placeholder="••••••••" className={inputCls} />
              </Field>
            </div>
            <SaveRow saving={savingConfluence} onSave={async () => { setSavingConfluence(true); await patch({ confluenceBaseUrl, confluenceSpaceKey, confluenceEmail, confluenceToken }); setSavingConfluence(false); }} />
          </div>
        )}

        {section === "tags" && (
          <div className="space-y-8">
            <div>
              <h3 className="text-sm font-bold text-white/70 uppercase tracking-widest mb-1">Tags</h3>
              <p className="text-xs text-white/25 mb-4">Shown as tag options on each ticket during a session</p>
              <TagEditor tags={tagPresets} onChange={setTagPresets} defaultTags={DEFAULT_TAG_PRESETS} />
              <SaveRow saving={savingTags} onSave={async () => { setSavingTags(true); await patch({ tagPresets }); setSavingTags(false); }} />
            </div>
            <div className="border-t border-white/8 pt-6">
              <h3 className="text-sm font-bold text-white/70 uppercase tracking-widest mb-1">Dependency types</h3>
              <p className="text-xs text-white/25 mb-4">Shown when a ticket has external dependencies</p>
              <TagEditor tags={dependencyTypes} onChange={setDependencyTypes} defaultTags={DEFAULT_DEPENDENCY_TYPES} />
              <SaveRow saving={savingDeps} onSave={async () => { setSavingDeps(true); await patch({ dependencyTypes }); setSavingDeps(false); }} />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
