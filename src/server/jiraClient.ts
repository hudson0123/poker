import { JiraComment, JiraConfig } from "@/lib/types";

interface AdfNode {
  type: string;
  text?: string;
  content?: AdfNode[];
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

export function adfToPlainText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const adf = node as AdfNode;

  if (adf.type === "text") return adf.text ?? "";
  if (adf.type === "mention") return (adf.attrs?.text as string) ?? "";
  if (adf.type === "hardBreak") return "\n";

  if (!adf.content || !Array.isArray(adf.content)) return "";

  if (adf.type === "bulletList") {
    return adf.content.map((item) => `- ${adfToPlainText(item)}`).join("\n");
  }

  if (adf.type === "orderedList") {
    return adf.content.map((item, i) => `${i + 1}. ${adfToPlainText(item)}`).join("\n");
  }

  if (adf.type === "listItem") {
    return adf.content.map((child) => adfToPlainText(child)).join("").trim();
  }

  const childTexts = adf.content.map((child) => adfToPlainText(child));

  if (adf.type === "heading") return "";

  if (adf.type === "paragraph" || adf.type === "codeBlock") {
    return childTexts.join("");
  }

  if (adf.type === "doc") {
    return childTexts.filter((t) => t.length > 0).join("\n\n");
  }

  return childTexts.join("");
}

function jiraHeaders(config: JiraConfig): Record<string, string> {
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
  return {
    Authorization: `Basic ${auth}`,
    Accept: "application/json",
  };
}

function jiraBaseUrl(config: JiraConfig): string {
  const base = config.baseUrl.replace(/\/+$/, "");
  return base.startsWith("http") ? base : `https://${base}`;
}

export async function assignStoryPoints(config: JiraConfig, issueKey: string, points: number, fieldId: string): Promise<void> {
  const url = `${jiraBaseUrl(config)}/rest/api/3/issue/${issueKey}`;
  const resp = await fetch(url, {
    method: "PUT",
    headers: { ...jiraHeaders(config), "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { [fieldId]: points } }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Jira API error: ${resp.status} ${resp.statusText}${body ? ` — ${body}` : ""}`);
  }
}

export async function getStoryPointsFieldId(config: JiraConfig, issueKey: string): Promise<string> {
  // Use the issue's own edit metadata — this shows exactly which fields are writable
  // and their actual field IDs for this project/issue type.
  try {
    const resp = await fetch(
      `${jiraBaseUrl(config)}/rest/api/3/issue/${issueKey}/editmeta`,
      { headers: jiraHeaders(config) }
    );
    if (resp.ok) {
      const data = await resp.json();
      const fields: Record<string, { name: string; schema: { type: string } }> = data.fields ?? {};
      for (const [id, field] of Object.entries(fields)) {
        if (field.schema?.type === "number" && field.name.toLowerCase().includes("story point")) {
          console.log(`[jira] story points field: ${id} ("${field.name}")`);
          return id;
        }
      }
    }
  } catch {
    // fall through to default
  }

  // Fallback: search global field list
  try {
    const resp = await fetch(`${jiraBaseUrl(config)}/rest/api/3/field`, { headers: jiraHeaders(config) });
    if (resp.ok) {
      const fields: Array<{ id: string; name: string; schema?: { type: string } }> = await resp.json();
      const match = fields.find(
        (f) => f.schema?.type === "number" && f.name.toLowerCase().includes("story point")
      );
      if (match) {
        console.log(`[jira] story points field (global): ${match.id} ("${match.name}")`);
        return match.id;
      }
    }
  } catch {
    // fall through
  }

  console.log("[jira] story points field not found, defaulting to story_points");
  return "story_points";
}

export async function fetchRefineTickets(config: JiraConfig): Promise<{ key: string; summary: string }[]> {
  const url = `${jiraBaseUrl(config)}/rest/api/3/search/jql`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { ...jiraHeaders(config), "Content-Type": "application/json" },
    body: JSON.stringify({
      jql: 'project = TA2 AND labels = "refine" AND statusCategory != "Done" ORDER BY created DESC',
      fields: ["summary", "key"],
      maxResults: 100,
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    console.error(`[refine] Jira search error: ${resp.status} ${resp.statusText} — ${body}`);
    return [];
  }
  const data = await resp.json();
  console.log(`[refine] Jira returned ${data.total} total, ${data.issues?.length} in page`);
  return (data.issues ?? []).map((issue: { key: string; fields: { summary: string } }) => ({
    key: issue.key,
    summary: issue.fields.summary ?? "",
  }));
}

export async function validateJiraCredentials(config: JiraConfig): Promise<boolean> {
  try {
    const resp = await fetch(`${jiraBaseUrl(config)}/rest/api/3/myself`, {
      headers: jiraHeaders(config),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function fetchJiraIssue(
  config: JiraConfig,
  issueKey: string
): Promise<{ summary: string; description: string; comments: JiraComment[] }> {
  const url = `${jiraBaseUrl(config)}/rest/api/3/issue/${issueKey}?fields=summary,description,comment`;
  const resp = await fetch(url, { headers: jiraHeaders(config) });
  console.log(`[jira] fetchJiraIssue ${issueKey}: ${resp.status}`);

  if (!resp.ok) {
    throw new Error(`Jira API error: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json();
  const summary = data.fields?.summary ?? "";
  const description = adfToPlainText(data.fields?.description);
  console.log(`[jira] ${issueKey} summary="${summary}" desc length=${description.length}`);
  const rawComments = data.fields?.comment?.comments ?? [];
  const comments: JiraComment[] = rawComments.map((c: { author?: { displayName?: string }; body?: unknown; created?: string }) => ({
    author: c.author?.displayName ?? "Unknown",
    body: adfToPlainText(c.body),
    created: c.created ?? "",
  }));

  return { summary, description, comments };
}
