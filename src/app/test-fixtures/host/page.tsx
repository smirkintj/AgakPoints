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
      id: "ticket-1",
      sessionId: SESSION_ID,
      jiraKey: "PROJ-101",
      title: "Implement user authentication",
      description: "Setup NextAuth credentials provider",
      order: 0,
      status: "PENDING",
      finalEstimate: null,
      adminNote: null,
      assigneeId: null,
      issueType: "Story",
      jiraAssigneeName: null,
      jiraAssigneeAccountId: null,
      contextNote: null,
      priority: "High",
      createdAt: "2026-01-01T00:00:00.000Z",
      votes: [],
    },
    {
      id: "ticket-2",
      sessionId: SESSION_ID,
      jiraKey: "PROJ-102",
      title: "Build dashboard UI",
      description: "Create the main dashboard with product list",
      order: 1,
      status: "PENDING",
      finalEstimate: null,
      adminNote: null,
      assigneeId: null,
      issueType: "Story",
      jiraAssigneeName: null,
      jiraAssigneeAccountId: null,
      contextNote: null,
      priority: "Medium",
      createdAt: "2026-01-01T00:00:00.000Z",
      votes: [],
    },
    {
      id: "ticket-3",
      sessionId: SESSION_ID,
      jiraKey: "PROJ-103",
      title: "Fix WebSocket reconnection bug",
      description: null,
      order: 2,
      status: "PENDING",
      finalEstimate: null,
      adminNote: null,
      assigneeId: null,
      issueType: "Bug",
      jiraAssigneeName: null,
      jiraAssigneeAccountId: null,
      contextNote: null,
      priority: "Highest",
      createdAt: "2026-01-01T00:00:00.000Z",
      votes: [],
    },
  ],
  participants: [],
  product: {
    id: PRODUCT_ID,
    jiraBaseUrl: null,
    members: [
      { id: "member-alice", productId: PRODUCT_ID, name: "Alice Dev", avatarUrl: null, role: "DEV", capacity: 20, createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "member-bob", productId: PRODUCT_ID, name: "Bob QA", avatarUrl: null, role: "QA", capacity: 15, createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "member-carol", productId: PRODUCT_ID, name: "Carol TL", avatarUrl: null, role: "TECH_LEAD", capacity: 10, createdAt: "2026-01-01T00:00:00.000Z" },
    ],
  },
};

export default function TestHostPage() {
  if (process.env.NODE_ENV === "production") return notFound();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <HostView session={mockSession as any} productId={PRODUCT_ID} />;
}
