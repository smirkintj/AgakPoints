import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const findSessionMock = vi.fn();
const findParticipantMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    pokerSession: { findUnique: (...args: unknown[]) => findSessionMock(...args) },
    sessionParticipant: { findUnique: (...args: unknown[]) => findParticipantMock(...args) },
  },
}));

const { authorizeSessionMutation } = await import("./member-auth");

const ACTIVE_SESSION = {
  id: "sess_1",
  status: "ACTIVE",
  product: { adminId: "user_host" },
};

function participant(role: string, checkedIn = true) {
  return { checkedIn, member: { role } };
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue(null);
  findSessionMock.mockResolvedValue(ACTIVE_SESSION);
  findParticipantMock.mockResolvedValue(null);
});

describe("authorizeSessionMutation", () => {
  it("lets the host through without a memberId", async () => {
    authMock.mockResolvedValue({ user: { id: "user_host" } });

    await expect(authorizeSessionMutation("sess_1", undefined, ["UI_UX"])).resolves.toEqual({
      ok: true,
      via: "host",
    });
  });

  it("does not let a different product's admin through", async () => {
    authMock.mockResolvedValue({ user: { id: "user_someone_else" } });

    const result = await authorizeSessionMutation("sess_1", undefined, ["UI_UX"]);
    expect(result).toEqual({ ok: false, status: 401, error: "memberId required" });
  });

  it("lets a checked-in member with an allowed role through", async () => {
    findParticipantMock.mockResolvedValue(participant("UI_UX"));

    await expect(authorizeSessionMutation("sess_1", "mem_1", ["UI_UX"])).resolves.toEqual({
      ok: true,
      via: "member",
    });
  });

  it("rejects a member whose role isn't allowed for this mutation", async () => {
    findParticipantMock.mockResolvedValue(participant("DEV"));

    const result = await authorizeSessionMutation("sess_1", "mem_1", ["UI_UX"]);
    expect(result).toEqual({ ok: false, status: 403, error: "Role not permitted" });
  });

  it("rejects a member who has not checked in", async () => {
    findParticipantMock.mockResolvedValue(participant("UI_UX", false));

    const result = await authorizeSessionMutation("sess_1", "mem_1", ["UI_UX"]);
    expect(result).toEqual({ ok: false, status: 403, error: "Not a checked-in participant" });
  });

  it("rejects a member who belongs to no participant row on this session", async () => {
    findParticipantMock.mockResolvedValue(null);

    const result = await authorizeSessionMutation("sess_1", "mem_1", ["UI_UX"]);
    expect(result).toEqual({ ok: false, status: 403, error: "Not a checked-in participant" });
  });

  it("rejects an anonymous caller with no memberId at all", async () => {
    const result = await authorizeSessionMutation("sess_1", undefined, ["UI_UX"]);
    expect(result).toEqual({ ok: false, status: 401, error: "memberId required" });
  });

  it("404s for a session that does not exist, without touching participants", async () => {
    findSessionMock.mockResolvedValue(null);

    const result = await authorizeSessionMutation("nope", "mem_1", ["UI_UX"]);
    expect(result).toEqual({ ok: false, status: 404, error: "Not found" });
    expect(findParticipantMock).not.toHaveBeenCalled();
  });

  it("treats a completed session as read-only for members", async () => {
    findSessionMock.mockResolvedValue({ ...ACTIVE_SESSION, status: "COMPLETED" });
    findParticipantMock.mockResolvedValue(participant("UI_UX"));

    const result = await authorizeSessionMutation("sess_1", "mem_1", ["UI_UX"]);
    expect(result).toEqual({ ok: false, status: 403, error: "Session has ended" });
  });

  it("still lets the host edit a completed session", async () => {
    authMock.mockResolvedValue({ user: { id: "user_host" } });
    findSessionMock.mockResolvedValue({ ...ACTIVE_SESSION, status: "COMPLETED" });

    await expect(authorizeSessionMutation("sess_1", undefined, ["UI_UX"])).resolves.toEqual({
      ok: true,
      via: "host",
    });
  });

  it("accepts any of several allowed roles", async () => {
    findParticipantMock.mockResolvedValue(participant("TECH_LEAD"));

    await expect(
      authorizeSessionMutation("sess_1", "mem_1", ["UI_UX", "TECH_LEAD"])
    ).resolves.toEqual({ ok: true, via: "member" });
  });

  it("scopes the participant lookup to the session being mutated", async () => {
    findParticipantMock.mockResolvedValue(participant("UI_UX"));

    await authorizeSessionMutation("sess_1", "mem_1", ["UI_UX"]);

    expect(findParticipantMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sessionId_memberId: { sessionId: "sess_1", memberId: "mem_1" } },
      })
    );
  });
});
