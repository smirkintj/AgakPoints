"use client";
import { useState } from "react";
import { X } from "lucide-react";

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/4 p-6 space-y-4">
      <h3 className="text-white font-semibold text-base">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-white/40 uppercase tracking-widest mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-violet-500 focus:outline-none";

function SaveButton({ onClick, saving, label = "Save" }: { onClick: () => void; saving: boolean; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="px-4 py-2 rounded-lg text-sm bg-violet-600 hover:bg-violet-500 text-white font-medium disabled:opacity-40 transition-colors"
    >
      {saving ? "Saving…" : label}
    </button>
  );
}

function TagEditor({
  tags,
  onChange,
  defaultTags,
  label,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  defaultTags: string[];
  label: string;
}) {
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  const addTag = () => {
    const val = input.trim();
    if (val && !tags.includes(val)) {
      onChange([...tags, val]);
    }
    setInput("");
  };

  const removeTag = (tag: string) => onChange(tags.filter((t) => t !== tag));

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/40 uppercase tracking-widest">{label}</p>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span key={tag} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-white/8 border border-white/15 text-white/70">
            {tag}
            <button onClick={() => removeTag(tag)} className="text-white/30 hover:text-white/70">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTag()}
          placeholder="Add tag…"
          className="flex-1 bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/25 focus:border-violet-500 focus:outline-none"
        />
        <button
          onClick={addTag}
          disabled={!input.trim()}
          className="px-3 py-1.5 rounded-lg text-xs bg-white/8 border border-white/15 text-white/60 hover:text-white hover:bg-white/12 disabled:opacity-30"
        >
          Add
        </button>
        <button
          onClick={() => onChange([...defaultTags])}
          className="px-3 py-1.5 rounded-lg text-xs bg-white/8 border border-white/15 text-white/40 hover:text-white/70"
          title="Reset to defaults"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

export function ProductSettings({
  productId,
  productName,
  jiraBaseUrl: initJiraBaseUrl,
  jiraProjectKey: initJiraProjectKey,
  jiraEmail: initJiraEmail,
  jiraApiToken: initJiraApiToken,
  jiraBoardId: initJiraBoardId,
  confluenceBaseUrl: initConfluenceBaseUrl,
  confluenceSpaceKey: initConfluenceSpaceKey,
  confluenceEmail: initConfluenceEmail,
  confluenceToken: initConfluenceToken,
  tagPresets: initTagPresets,
  dependencyTypes: initDependencyTypes,
}: ProductSettingsProps) {
  // Product name
  const [name, setName] = useState(productName);
  const [savingName, setSavingName] = useState(false);

  // JIRA
  const [jiraBaseUrl, setJiraBaseUrl] = useState(initJiraBaseUrl ?? "");
  const [jiraProjectKey, setJiraProjectKey] = useState(initJiraProjectKey ?? "");
  const [jiraEmail, setJiraEmail] = useState(initJiraEmail ?? "");
  const [jiraApiToken, setJiraApiToken] = useState(initJiraApiToken ?? "");
  const [jiraBoardId, setJiraBoardId] = useState(initJiraBoardId ?? "");
  const [savingJira, setSavingJira] = useState(false);
  const [jiraTestResult, setJiraTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testingJira, setTestingJira] = useState(false);

  // Confluence
  const [confluenceBaseUrl, setConfluenceBaseUrl] = useState(initConfluenceBaseUrl ?? "");
  const [confluenceSpaceKey, setConfluenceSpaceKey] = useState(initConfluenceSpaceKey ?? "");
  const [confluenceEmail, setConfluenceEmail] = useState(initConfluenceEmail ?? "");
  const [confluenceToken, setConfluenceToken] = useState(initConfluenceToken ?? "");
  const [savingConfluence, setSavingConfluence] = useState(false);

  // Tags
  const [tagPresets, setTagPresets] = useState<string[]>(initTagPresets.length > 0 ? initTagPresets : [...DEFAULT_TAG_PRESETS]);
  const [savingTags, setSavingTags] = useState(false);

  // Dependency types
  const [dependencyTypes, setDependencyTypes] = useState<string[]>(initDependencyTypes.length > 0 ? initDependencyTypes : [...DEFAULT_DEPENDENCY_TYPES]);
  const [savingDeps, setSavingDeps] = useState(false);

  const patch = async (data: Record<string, unknown>) => {
    const res = await fetch(`/api/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.ok;
  };

  const saveName = async () => {
    setSavingName(true);
    await patch({ name });
    setSavingName(false);
  };

  const saveJira = async () => {
    setSavingJira(true);
    await patch({ jiraBaseUrl, jiraProjectKey, jiraEmail, jiraApiToken, jiraBoardId });
    setSavingJira(false);
  };

  const testJira = async () => {
    setTestingJira(true);
    setJiraTestResult(null);
    const res = await fetch(`/api/products/${productId}/jira-test`);
    const data = await res.json();
    setJiraTestResult(data.ok ? { ok: true, message: `Connected as ${data.displayName}` } : { ok: false, message: data.error });
    setTestingJira(false);
  };

  const saveConfluence = async () => {
    setSavingConfluence(true);
    await patch({ confluenceBaseUrl, confluenceSpaceKey, confluenceEmail, confluenceToken });
    setSavingConfluence(false);
  };

  const saveTags = async () => {
    setSavingTags(true);
    await patch({ tagPresets });
    setSavingTags(false);
  };

  const saveDeps = async () => {
    setSavingDeps(true);
    await patch({ dependencyTypes });
    setSavingDeps(false);
  };

  return (
    <div className="space-y-6">
      {/* Product */}
      <Section title="Product">
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <div className="flex justify-end">
          <SaveButton onClick={saveName} saving={savingName} />
        </div>
      </Section>

      {/* JIRA */}
      <Section title="JIRA">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Base URL">
            <input value={jiraBaseUrl} onChange={(e) => setJiraBaseUrl(e.target.value)} placeholder="https://yourcompany.atlassian.net" className={inputCls} />
          </Field>
          <Field label="Project Key">
            <input value={jiraProjectKey} onChange={(e) => setJiraProjectKey(e.target.value)} placeholder="PROJ" className={inputCls} />
          </Field>
          <Field label="Email">
            <input value={jiraEmail} onChange={(e) => setJiraEmail(e.target.value)} type="email" className={inputCls} />
          </Field>
          <Field label="API Token">
            <input value={jiraApiToken} onChange={(e) => setJiraApiToken(e.target.value)} type="password" placeholder="••••••••" className={inputCls} />
          </Field>
          <Field label="Board ID">
            <input value={jiraBoardId} onChange={(e) => setJiraBoardId(e.target.value)} placeholder="123" className={inputCls} />
          </Field>
        </div>
        {jiraTestResult && (
          <p className={`text-sm ${jiraTestResult.ok ? "text-emerald-400" : "text-red-400"}`}>
            {jiraTestResult.message}
          </p>
        )}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={testJira}
            disabled={testingJira}
            className="px-4 py-2 rounded-lg text-sm bg-white/8 border border-white/15 text-white/60 hover:text-white hover:bg-white/12 disabled:opacity-40 transition-colors"
          >
            {testingJira ? "Testing…" : "Test connection"}
          </button>
          <SaveButton onClick={saveJira} saving={savingJira} />
        </div>
      </Section>

      {/* Confluence */}
      <Section title="Confluence">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Base URL">
            <input value={confluenceBaseUrl} onChange={(e) => setConfluenceBaseUrl(e.target.value)} placeholder="https://yourcompany.atlassian.net/wiki" className={inputCls} />
          </Field>
          <Field label="Space Key">
            <input value={confluenceSpaceKey} onChange={(e) => setConfluenceSpaceKey(e.target.value)} placeholder="SPACE" className={inputCls} />
          </Field>
          <Field label="Email">
            <input value={confluenceEmail} onChange={(e) => setConfluenceEmail(e.target.value)} type="email" className={inputCls} />
          </Field>
          <Field label="API Token">
            <input value={confluenceToken} onChange={(e) => setConfluenceToken(e.target.value)} type="password" placeholder="••••••••" className={inputCls} />
          </Field>
        </div>
        <div className="flex justify-end">
          <SaveButton onClick={saveConfluence} saving={savingConfluence} />
        </div>
      </Section>

      {/* Tags */}
      <Section title="Tags">
        <TagEditor
          tags={tagPresets}
          onChange={setTagPresets}
          defaultTags={DEFAULT_TAG_PRESETS}
          label="Tag presets"
        />
        <div className="flex justify-end">
          <SaveButton onClick={saveTags} saving={savingTags} />
        </div>
      </Section>

      {/* Dependency Types */}
      <Section title="Dependency Types">
        <TagEditor
          tags={dependencyTypes}
          onChange={setDependencyTypes}
          defaultTags={DEFAULT_DEPENDENCY_TYPES}
          label="Dependency type presets"
        />
        <div className="flex justify-end">
          <SaveButton onClick={saveDeps} saving={savingDeps} />
        </div>
      </Section>
    </div>
  );
}
