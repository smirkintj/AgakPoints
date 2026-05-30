import { notFound } from "next/navigation";
import { WaitingRoom } from "@/app/join/[sessionId]/WaitingRoom";

export const dynamic = "force-dynamic";

const SESSION_ID = "test-session-001";
const PRODUCT_ID = "test-product-001";

const mockSession = {
  id: SESSION_ID,
  productId: PRODUCT_ID,
  sprintId: "sprint-42",
  sprintName: "Sprint 42",
  name: "E2E Test Session",
  status: "WAITING" as const,
  sprintStartDate: null,
  sprintEndDate: null,
  createdAt: new Date("2026-01-01"),
  completedAt: null,
  participants: [],
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
      { id: "member-carol", productId: PRODUCT_ID, name: "Carol TL", avatarUrl: null, role: "TECH_LEAD" as const, capacity: 10, createdAt: new Date("2026-01-01") },
    ],
  },
};

export default function TestWaitingRoomPage() {
  if (process.env.NODE_ENV === "production") return notFound();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <WaitingRoom session={mockSession as any} />;
}
