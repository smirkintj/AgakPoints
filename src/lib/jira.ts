export interface JiraSprint {
  id: number;
  name: string;
  state: string;
  startDate?: string;
  endDate?: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description?: { content?: unknown[] } | null;
    story_points?: number;
    [key: string]: unknown;
  };
}

function authHeader(email: string, token: string) {
  return "Basic " + Buffer.from(`${email}:${token}`).toString("base64");
}

export async function fetchSprints(
  baseUrl: string,
  email: string,
  token: string,
  boardId: string
): Promise<JiraSprint[]> {
  const res = await fetch(
    `${baseUrl}/rest/agile/1.0/board/${boardId}/sprint?state=active,future`,
    {
      headers: {
        Authorization: authHeader(email, token),
        Accept: "application/json",
      },
    }
  );
  if (!res.ok) throw new Error(`JIRA sprints fetch failed: ${res.status}`);
  const data = await res.json();
  return data.values ?? [];
}

export async function fetchSprintIssues(
  baseUrl: string,
  email: string,
  token: string,
  sprintId: string
): Promise<JiraIssue[]> {
  const res = await fetch(
    `${baseUrl}/rest/agile/1.0/sprint/${sprintId}/issue?maxResults=100&fields=summary,description`,
    {
      headers: {
        Authorization: authHeader(email, token),
        Accept: "application/json",
      },
    }
  );
  if (!res.ok) throw new Error(`JIRA issues fetch failed: ${res.status}`);
  const data = await res.json();
  return data.issues ?? [];
}

export async function updateStoryPoints(
  baseUrl: string,
  email: string,
  token: string,
  issueKey: string,
  points: number,
  storyPointsFieldId = "story_points"
): Promise<void> {
  const body = { fields: { [storyPointsFieldId]: points } };
  const res = await fetch(`${baseUrl}/rest/api/3/issue/${issueKey}`, {
    method: "PUT",
    headers: {
      Authorization: authHeader(email, token),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`JIRA update story points failed: ${res.status}`);
  }
}

export async function updateAssignee(
  baseUrl: string,
  email: string,
  token: string,
  issueKey: string,
  accountId: string
): Promise<void> {
  const res = await fetch(`${baseUrl}/rest/api/3/issue/${issueKey}`, {
    method: "PUT",
    headers: {
      Authorization: authHeader(email, token),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ fields: { assignee: { accountId } } }),
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`JIRA update assignee failed: ${res.status}`);
  }
}

export async function postSessionComment(
  baseUrl: string,
  email: string,
  token: string,
  issueKey: string,
  commentBody: string
): Promise<void> {
  const body = {
    body: {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: commentBody }],
        },
      ],
    },
  };
  const res = await fetch(`${baseUrl}/rest/api/3/issue/${issueKey}/comment`, {
    method: "POST",
    headers: {
      Authorization: authHeader(email, token),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`JIRA post comment failed: ${res.status}`);
}

export function buildSessionComment(params: {
  sessionName: string;
  participants: string[];
  votes: { memberName: string; value: number }[];
  finalEstimate: number;
  note?: string;
}): string {
  const lines = [
    `🃏 AgakPoints Session: ${params.sessionName}`,
    ``,
    `Participants: ${params.participants.join(", ")}`,
    ``,
    `Votes:`,
    ...params.votes.map((v) => `  • ${v.memberName}: ${v.value}`),
    ``,
    `Final Estimate: ${params.finalEstimate} points`,
  ];
  if (params.note) lines.push(``, `Notes: ${params.note}`);
  return lines.join("\n");
}
