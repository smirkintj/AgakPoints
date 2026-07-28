◇ injected env (0) from .env.local // tip: ⌘ enable debugging { debug: true }
◇ injected env (0) from .env // tip: ⌘ suppress logs { quiet: true }
Loaded Prisma config from prisma.config.ts.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('DEV', 'QA', 'UI_UX', 'SM', 'TECH_LEAD');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('WAITING', 'ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DesignReadiness" AS ENUM ('READY', 'IN_PROGRESS', 'NOT_STARTED');

-- CreateEnum
CREATE TYPE "DesignComplexity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('PENDING', 'VOTING', 'REVEALED', 'ESTIMATED');

-- CreateEnum
CREATE TYPE "AchievementType" AS ENUM ('ORACLE', 'OPTIMIST', 'REALIST', 'CHAOS_AGENT', 'LOAD_BEARER', 'PHILOSOPHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "jiraBaseUrl" TEXT,
    "jiraProjectKey" TEXT,
    "jiraApiToken" TEXT,
    "jiraEmail" TEXT,
    "jiraBoardId" TEXT,
    "confluenceBaseUrl" TEXT,
    "confluenceSpaceKey" TEXT,
    "confluenceToken" TEXT,
    "confluenceEmail" TEXT,
    "tagPresets" TEXT[],
    "dependencyTypes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "role" "MemberRole" NOT NULL DEFAULT 'DEV',
    "capacity" INTEGER NOT NULL DEFAULT 20,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PokerSession" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "sprintName" TEXT NOT NULL,
    "name" TEXT,
    "shortCode" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'WAITING',
    "sprintStartDate" TIMESTAMP(3),
    "sprintEndDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PokerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "checkedIn" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "jiraKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TicketStatus" NOT NULL DEFAULT 'PENDING',
    "finalEstimate" INTEGER,
    "adminNote" TEXT,
    "order" INTEGER NOT NULL,
    "assigneeId" TEXT,
    "issueType" TEXT,
    "jiraAssigneeName" TEXT,
    "jiraAssigneeAccountId" TEXT,
    "contextNote" TEXT,
    "priority" TEXT,
    "designReadiness" "DesignReadiness",
    "designComplexity" "DesignComplexity",
    "designLink" TEXT,
    "tags" TEXT[],
    "noteForDev" TEXT,
    "noteForQA" TEXT,
    "noteForUIUX" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "type" "AchievementType" NOT NULL,
    "sessionId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SprintLeave" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SprintLeave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SprintHoliday" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PH',
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SprintHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Member_productId_idx" ON "Member"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "PokerSession_shortCode_key" ON "PokerSession"("shortCode");

-- CreateIndex
CREATE INDEX "PokerSession_productId_idx" ON "PokerSession"("productId");

-- CreateIndex
CREATE INDEX "SessionParticipant_sessionId_idx" ON "SessionParticipant"("sessionId");

-- CreateIndex
CREATE INDEX "SessionParticipant_memberId_idx" ON "SessionParticipant"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionParticipant_sessionId_memberId_key" ON "SessionParticipant"("sessionId", "memberId");

-- CreateIndex
CREATE INDEX "Ticket_sessionId_idx" ON "Ticket"("sessionId");

-- CreateIndex
CREATE INDEX "Vote_ticketId_idx" ON "Vote"("ticketId");

-- CreateIndex
CREATE INDEX "Vote_memberId_idx" ON "Vote"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_ticketId_memberId_key" ON "Vote"("ticketId", "memberId");

-- CreateIndex
CREATE INDEX "SprintLeave_sessionId_idx" ON "SprintLeave"("sessionId");

-- CreateIndex
CREATE INDEX "SprintLeave_memberId_idx" ON "SprintLeave"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "SprintLeave_sessionId_memberId_date_key" ON "SprintLeave"("sessionId", "memberId", "date");

-- CreateIndex
CREATE INDEX "SprintHoliday_sessionId_idx" ON "SprintHoliday"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SprintHoliday_sessionId_date_key" ON "SprintHoliday"("sessionId", "date");

-- CreateIndex
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PokerSession" ADD CONSTRAINT "PokerSession_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionParticipant" ADD CONSTRAINT "SessionParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PokerSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionParticipant" ADD CONSTRAINT "SessionParticipant_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PokerSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

