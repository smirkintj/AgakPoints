/**
 * Shared mock data for Playwright E2E tests.
 * Dates use ISO strings to mimic the JSON.parse(JSON.stringify(...)) serialization
 * that the real Next.js pages apply before passing data to client components.
 */

export const SESSION_ID = "test-session-001";
export const PRODUCT_ID = "test-product-001";
export const ADMIN_USER = { email: "host@test.com", password: "TestPass123", name: "Host User" };
export const REG_USER = { email: `reg${Date.now()}@test.com`, password: "RegPass456", name: "Reg User" };

export const MOCK_MEMBERS = [
  {
    id: "member-alice",
    productId: PRODUCT_ID,
    name: "Alice Dev",
    avatarUrl: null,
    role: "DEV",
    capacity: 20,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "member-bob",
    productId: PRODUCT_ID,
    name: "Bob QA",
    avatarUrl: null,
    role: "QA",
    capacity: 15,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "member-carol",
    productId: PRODUCT_ID,
    name: "Carol TL",
    avatarUrl: null,
    role: "TECH_LEAD",
    capacity: 10,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

export const MOCK_TICKETS = [
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
];

export const MOCK_PRODUCT = {
  id: PRODUCT_ID,
  name: "AgakPoints Test Product",
  adminId: "admin-user-1",
  jiraBaseUrl: null,
  jiraProjectKey: null,
  jiraApiToken: null,
  jiraEmail: null,
  jiraBoardId: null,
  confluenceBaseUrl: null,
  confluenceSpaceKey: null,
  confluenceToken: null,
  confluenceEmail: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  members: MOCK_MEMBERS,
};

export const MOCK_SESSION_WAITING = {
  id: SESSION_ID,
  productId: PRODUCT_ID,
  sprintId: "sprint-42",
  sprintName: "Sprint 42",
  name: "E2E Test Session",
  status: "WAITING",
  sprintStartDate: "2026-05-26T00:00:00.000Z",
  sprintEndDate: "2026-06-09T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  completedAt: null,
  tickets: MOCK_TICKETS,
  participants: [],
  product: MOCK_PRODUCT,
};

export const MOCK_SESSION_ACTIVE = {
  ...MOCK_SESSION_WAITING,
  status: "ACTIVE",
};
