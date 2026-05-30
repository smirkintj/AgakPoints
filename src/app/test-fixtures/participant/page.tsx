import { notFound } from "next/navigation";
import { ParticipantView } from "@/app/session/[sessionId]/ParticipantView";

export const dynamic = "force-dynamic";

const SESSION_ID = "test-session-001";
const PRODUCT_ID = "test-product-001";

const mockSession = {
  id: SESSION_ID,
  productId: PRODUCT_ID,
  sprintId: "sprint-42",
  sprintName: "Sprint 42",
  name: "E2E Test Session",
  status: "ACTIVE" as const,
  sprintStartDate: null,
  sprintEndDate: null,
  createdAt: new Date("2026-01-01"),
  completedAt: null,
  tickets: [
    {
      id: "ticket-1",
      sessionId: SESSION_ID,
      jiraKey: "PROJ-101",
      title: "Implement user authentication",
      description: "Setup NextAuth credentials provider",
      order: 0,
      status: "PENDING" as const,
      finalEstimate: null,
      adminNote: null,
      assigneeId: null,
      issueType: "Story",
      jiraAssigneeName: null,
      jiraAssigneeAccountId: null,
      contextNote: null,
      priority: "High",
      createdAt: new Date("2026-01-01"),
    },
    {
      id: "ticket-2",
      sessionId: SESSION_ID,
      jiraKey: "PROJ-102",
      title: "Build dashboard UI",
      description: "Create the main dashboard with product list",
      order: 1,
      status: "PENDING" as const,
      finalEstimate: null,
      adminNote: null,
      assigneeId: null,
      issueType: "Story",
      jiraAssigneeName: null,
      jiraAssigneeAccountId: null,
      contextNote: null,
      priority: "Medium",
      createdAt: new Date("2026-01-01"),
    },
  ],
  product: {
    id: PRODUCT_ID,
    name: "AgakPoints Test Product",
    adminId: "admin-1",
    jiraBaseUrl: null,
    jiraProjectKey: null,
    jiraApiToken: null,
    jiraEmail: null,
    jiraBoardId: null,
    confluenceBaseUrl: null,
    confluenceSpaceKey: null,
    confluenceToken: null,
    confluenceEmail: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    members: [
      { id: "member-alice", productId: PRODUCT_ID, name: "Alice Dev", avatarUrl: null, role: "DEV" as const, capacity: 20, createdAt: new Date("2026-01-01") },
      { id: "member-bob", productId: PRODUCT_ID, name: "Bob QA", avatarUrl: null, role: "QA" as const, capacity: 15, createdAt: new Date("2026-01-01") },
    ],
  },
};

export default function TestParticipantPage() {
  if (process.env.NODE_ENV === "production") return notFound();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ParticipantView session={mockSession as any} />;
}
