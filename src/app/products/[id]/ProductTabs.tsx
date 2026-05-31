"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SessionList } from "./SessionList";
import { MemberManager } from "./MemberManager";
import { ProductSettings } from "./ProductSettings";

type Session = {
  id: string;
  name?: string | null;
  sprintName: string;
  createdAt: Date;
  status: string;
  _count: { tickets: number };
  estimatedCount: number;
  totalPts: number;
  attendeeCount: number;
};

type Member = {
  id: string;
  name: string;
  role: string;
  capacity: number;
  country?: string | null;
  avatarUrl?: string | null;
};

interface ProductTabsProps {
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
  sessions: Session[];
  members: Member[];
}

const TABS = ["Sessions", "Team", "Settings"] as const;
type Tab = (typeof TABS)[number];

export function ProductTabs({
  productId,
  productName,
  jiraBaseUrl,
  jiraProjectKey,
  jiraEmail,
  jiraApiToken,
  jiraBoardId,
  confluenceBaseUrl,
  confluenceSpaceKey,
  confluenceEmail,
  confluenceToken,
  tagPresets,
  dependencyTypes,
  sessions,
  members,
}: ProductTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("Sessions");

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-white/10 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "text-violet-400 border-violet-500"
                : "text-white/40 border-transparent hover:text-white/60"
            }`}
          >
            {tab}
            {tab === "Sessions" && (
              <span className="ml-1.5 text-xs text-white/25">({sessions.length})</span>
            )}
            {tab === "Team" && (
              <span className="ml-1.5 text-xs text-white/25">({members.length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "Sessions" && (
        <div>
          <SessionList productId={productId} sessions={sessions} />
          {sessions.length === 0 && (
            <div className="text-center pt-4">
              <Link href={`/products/${productId}/sessions/new`}>
                <Button size="sm">Start First Session</Button>
              </Link>
            </div>
          )}
        </div>
      )}

      {activeTab === "Team" && (
        <MemberManager
          productId={productId}
          initialMembers={members}
        />
      )}

      {activeTab === "Settings" && (
        <ProductSettings
          productId={productId}
          productName={productName}
          jiraBaseUrl={jiraBaseUrl}
          jiraProjectKey={jiraProjectKey}
          jiraEmail={jiraEmail}
          jiraApiToken={jiraApiToken}
          jiraBoardId={jiraBoardId}
          confluenceBaseUrl={confluenceBaseUrl}
          confluenceSpaceKey={confluenceSpaceKey}
          confluenceEmail={confluenceEmail}
          confluenceToken={confluenceToken}
          tagPresets={tagPresets}
          dependencyTypes={dependencyTypes}
        />
      )}
    </div>
  );
}
