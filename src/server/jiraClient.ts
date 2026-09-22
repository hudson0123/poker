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

  if (adf.type === "paragraph" || adf.type === "heading" || adf.type === "codeBlock") {
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
): Promise<{ description: string; comments: JiraComment[] }> {
  const url = `${jiraBaseUrl(config)}/rest/api/3/issue/${issueKey}?fields=summary,description,comment`;
  const resp = await fetch(url, { headers: jiraHeaders(config) });

  if (!resp.ok) {
    throw new Error(`Jira API error: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json();
  const description = adfToPlainText(data.fields?.description);
  const rawComments = data.fields?.comment?.comments ?? [];
  const comments: JiraComment[] = rawComments.map((c: { author?: { displayName?: string }; body?: unknown; created?: string }) => ({
    author: c.author?.displayName ?? "Unknown",
    body: adfToPlainText(c.body),
    created: c.created ?? "",
  }));

  return { description, comments };
}
