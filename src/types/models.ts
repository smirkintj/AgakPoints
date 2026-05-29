// Shared domain types matching the Prisma schema
// Used in place of @prisma/client imports until client is generated

export type MemberRole = "DEV" | "QA" | "UI_UX" | "SM" | "TECH_LEAD";
export type SessionStatus = "WAITING" | "ACTIVE" | "COMPLETED";
export type TicketStatus = "PENDING" | "VOTING" | "REVEALED" | "ESTIMATED";
export type AchievementType = "SNIPER" | "WILDCARD" | "SPEEDSTER" | "FIRST_BLOOD" | "ON_FIRE" | "TEAM_PLAYER";

export interface Member {
  id: string;
  productId: string;
  name: string;
  avatarUrl: string | null;
  role: MemberRole;
  capacity: number;
  createdAt: Date;
}

export interface Product {
  id: string;
  name: string;
  adminId: string;
  jiraBaseUrl: string | null;
  jiraProjectKey: string | null;
  jiraApiToken: string | null;
  jiraEmail: string | null;
  jiraBoardId: string | null;
  confluenceBaseUrl: string | null;
  confluenceSpaceKey: string | null;
  confluenceToken: string | null;
  confluenceEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PokerSession {
  id: string;
  productId: string;
  sprintId: string;
  sprintName: string;
  status: SessionStatus;
  createdAt: Date;
  completedAt: Date | null;
}

export interface SessionParticipant {
  id: string;
  sessionId: string;
  memberId: string;
  checkedIn: boolean;
  joinedAt: Date;
}

export interface Ticket {
  id: string;
  sessionId: string;
  jiraKey: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  finalEstimate: number | null;
  adminNote: string | null;
  order: number;
  assigneeId: string | null;
  createdAt: Date;
}

export interface Vote {
  id: string;
  ticketId: string;
  memberId: string;
  value: number;
  createdAt: Date;
}
