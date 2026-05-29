export interface LeaveEntry {
  memberName: string;
  startDate: string;
  endDate: string;
  type: string;
}

function authHeader(email: string, token: string) {
  return "Basic " + Buffer.from(`${email}:${token}`).toString("base64");
}

export async function fetchLeaves(
  baseUrl: string,
  email: string,
  token: string,
  spaceKey: string,
  sprintStart: string,
  sprintEnd: string
): Promise<LeaveEntry[]> {
  try {
    // Search for leave/absence pages in the space
    const searchUrl = `${baseUrl}/wiki/rest/api/content/search?cql=type=page AND space="${spaceKey}" AND (title~"leave" OR title~"absence" OR title~"calendar")&expand=body.storage&limit=5`;
    const res = await fetch(searchUrl, {
      headers: {
        Authorization: authHeader(email, token),
        Accept: "application/json",
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const results: LeaveEntry[] = [];
    for (const page of data.results ?? []) {
      const pageLeaves = parseLeaveTable(page.body?.storage?.value ?? "", sprintStart, sprintEnd);
      results.push(...pageLeaves);
    }
    return results;
  } catch {
    return [];
  }
}

function parseLeaveTable(html: string, sprintStart: string, sprintEnd: string): LeaveEntry[] {
  // Basic regex extraction from Confluence table HTML
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];
  const leaves: LeaveEntry[] = [];
  const start = new Date(sprintStart);
  const end = new Date(sprintEnd);

  for (const row of rows.slice(1)) {
    const cells = (row.match(/<td[^>]*>[\s\S]*?<\/td>/g) ?? []).map((c) =>
      c.replace(/<[^>]+>/g, "").trim()
    );
    if (cells.length >= 3) {
      const [name, dateStart, dateEnd, type = "Leave"] = cells;
      const leaveStart = new Date(dateStart);
      const leaveEnd = new Date(dateEnd ?? dateStart);
      // Only include leaves that overlap with the sprint
      if (leaveEnd >= start && leaveStart <= end && name) {
        leaves.push({ memberName: name, startDate: dateStart, endDate: dateEnd ?? dateStart, type });
      }
    }
  }
  return leaves;
}

export async function fetchPublicHolidays(
  countryCode: string,
  year: number
): Promise<{ date: string; name: string }[]> {
  try {
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}
