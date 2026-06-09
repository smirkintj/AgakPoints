import { notFound } from "next/navigation";
import { HostView } from "@/app/products/[id]/sessions/[sessionId]/host/HostView";

export const dynamic = "force-dynamic";

const SESSION_ID = "test-session-001";
const PRODUCT_ID = "test-product-001";

const mockSession = {
  id: SESSION_ID,
  name: "E2E Test Session",
  sprintName: "Sprint 42",
  sprintStartDate: "2026-05-26T00:00:00.000Z",
  sprintEndDate: "2026-06-09T00:00:00.000Z",
  status: "WAITING",
  tickets: [
    {
      id: "ticket-1", sessionId: SESSION_ID, jiraKey: "PROJ-101",
      title: "Implement user authentication",
      description: "Setup NextAuth credentials provider with email/password login and session management.",
      order: 0, status: "PENDING", finalEstimate: null, adminNote: null,
      assigneeId: null, issueType: "Story", jiraAssigneeName: null,
      jiraAssigneeAccountId: null, contextNote: null, priority: "High",
      createdAt: "2026-01-01T00:00:00.000Z", votes: [],
    },
    {
      id: "ticket-2", sessionId: SESSION_ID, jiraKey: "PROJ-102",
      title: "Build dashboard analytics panel",
      description: "Create reusable chart widgets for the analytics dashboard with real-time data.",
      order: 1, status: "PENDING", finalEstimate: null, adminNote: null,
      assigneeId: null, issueType: "Story", jiraAssigneeName: null,
      jiraAssigneeAccountId: null, contextNote: null, priority: "Medium",
      createdAt: "2026-01-01T00:00:00.000Z", votes: [],
    },
    {
      id: "ticket-3", sessionId: SESSION_ID, jiraKey: "PROJ-103",
      title: "Fix WebSocket reconnection bug",
      description: "Clients lose state on network drop and do not recover gracefully.",
      order: 2, status: "PENDING", finalEstimate: null, adminNote: null,
      assigneeId: null, issueType: "Bug", jiraAssigneeName: null,
      jiraAssigneeAccountId: null, contextNote: null, priority: "Highest",
      createdAt: "2026-01-01T00:00:00.000Z", votes: [],
    },
    {
      id: "ticket-4", sessionId: SESSION_ID, jiraKey: "PROJ-104",
      title: "Mobile responsive layout",
      description: "Make the session view fully usable on phones and tablets.",
      order: 3, status: "PENDING", finalEstimate: null, adminNote: null,
      assigneeId: null, issueType: "Story", jiraAssigneeName: null,
      jiraAssigneeAccountId: null, contextNote: null, priority: "Low",
      createdAt: "2026-01-01T00:00:00.000Z", votes: [],
    },
    {
      id: "ticket-5", sessionId: SESSION_ID, jiraKey: "PROJ-105",
      title: "Performance: lazy-load ticket sidebar",
      description: "Sidebar renders all tickets eagerly — virtualise the list for sessions with 100+ tickets.",
      order: 4, status: "PENDING", finalEstimate: null, adminNote: null,
      assigneeId: null, issueType: "Story", jiraAssigneeName: null,
      jiraAssigneeAccountId: null, contextNote: null, priority: "Medium",
      createdAt: "2026-01-01T00:00:00.000Z", votes: [],
    },
  ],
  participants: [],
  product: {
    id: PRODUCT_ID,
    jiraBaseUrl: null,
    members: [
      { id: "member-alice",  productId: PRODUCT_ID, name: "Alice Dev",   avatarUrl: null, role: "DEV",       capacity: 20, createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "member-bob",    productId: PRODUCT_ID, name: "Bob QA",      avatarUrl: null, role: "QA",        capacity: 15, createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "member-carol",  productId: PRODUCT_ID, name: "Carol TL",    avatarUrl: null, role: "TECH_LEAD", capacity: 10, createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "member-dave",   productId: PRODUCT_ID, name: "Dave SM",     avatarUrl: null, role: "SM",        capacity: 5,  createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "member-eve",    productId: PRODUCT_ID, name: "Eve Dev",     avatarUrl: null, role: "DEV",       capacity: 20, createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "member-frank",  productId: PRODUCT_ID, name: "Frank Dev",   avatarUrl: null, role: "DEV",       capacity: 18, createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "member-grace",  productId: PRODUCT_ID, name: "Grace UI",    avatarUrl: null, role: "UI_UX",     capacity: 16, createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "member-henry",  productId: PRODUCT_ID, name: "Henry Dev",   avatarUrl: null, role: "DEV",       capacity: 20, createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "member-iris",   productId: PRODUCT_ID, name: "Iris QA",     avatarUrl: null, role: "QA",        capacity: 15, createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "member-jack",   productId: PRODUCT_ID, name: "Jack Dev",    avatarUrl: null, role: "DEV",       capacity: 20, createdAt: "2026-01-01T00:00:00.000Z" },
    ],
  },
};

export default function TestHostPage() {
  if (process.env.NODE_ENV === "production") return notFound();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <HostView session={mockSession as any} productId={PRODUCT_ID} />;
}
