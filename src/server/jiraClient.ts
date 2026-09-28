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

// Characters that would otherwise be read as Markdown syntax. `>` and list
// markers only matter at the start of a line, which plain Jira text rarely hits.
const MARKDOWN_SPECIAL = /[\\`*_[\]<~|]/g;

function escapeMarkdown(text: string): string {
  return text.replace(MARKDOWN_SPECIAL, "\\$&");
}

function linkTarget(href: string): string {
  return /[\s()]/.test(href) ? `<${href}>` : href;
}

function renderTextNode(node: AdfNode): string {
  const text = node.text ?? "";
  const marks = node.marks ?? [];
  const has = (type: string) => marks.some((m) => m.type === type);

  // Emphasis delimiters must hug the text ("**bold** " not "**bold **"),
  // so keep surrounding whitespace outside the marks.
  const [, lead, core, trail] = text.match(/^(\s*)([\s\S]*?)(\s*)$/) ?? ["", "", text, ""];
  if (!core) return text;

  let out = has("code") ? (core.includes("`") ? `\`\` ${core} \`\`` : `\`${core}\``) : escapeMarkdown(core);
  if (has("em")) out = `*${out}*`;
  if (has("strong")) out = `**${out}**`;
  if (has("strike")) out = `~~${out}~~`;
  const href = marks.find((m) => m.type === "link")?.attrs?.href;
  if (typeof href === "string") out = `[${out}](${linkTarget(href)})`;
  return lead + out + trail;
}

function renderInline(nodes: AdfNode[] | undefined): string {
  return (nodes ?? []).map(renderInlineNode).join("");
}

function renderInlineNode(node: AdfNode): string {
  const attrs = node.attrs ?? {};
  switch (node.type) {
    case "text":
      return renderTextNode(node);
    case "hardBreak":
      return "  \n";
    case "mention":
      return escapeMarkdown((attrs.text as string) ?? "");
    case "emoji":
      return (attrs.text as string) ?? (attrs.shortName as string) ?? "";
    case "status":
      return escapeMarkdown((attrs.text as string) ?? "");
    case "date":
      return attrs.timestamp ? new Date(Number(attrs.timestamp)).toISOString().slice(0, 10) : "";
    case "inlineCard": {
      const url = attrs.url as string | undefined;
      return url ? `[${url}](${linkTarget(url)})` : "";
    }
    default:
      return renderInline(node.content);
  }
}

function renderBlocks(nodes: AdfNode[] | undefined): string {
  return (nodes ?? [])
    .map(renderBlock)
    .filter((block) => block.length > 0)
    .join("\n\n");
}

// Indents every line after the first so it lines up under a list item's text.
function indentContinuation(text: string, width: number): string {
  const pad = " ".repeat(width);
  return text
    .split("\n")
    .map((line, i) => (i === 0 || line === "" ? line : pad + line))
    .join("\n");
}

function renderList(items: AdfNode[], marker: (index: number) => string): string {
  return items
    .map((item, i) => {
      const prefix = marker(i);
      const body = (item.content ?? [])
        .map(renderBlock)
        .filter((block) => block.length > 0)
        .join("\n");
      return prefix + indentContinuation(body, prefix.length);
    })
    .join("\n");
}

function renderTaskList(node: AdfNode): string {
  return (node.content ?? [])
    .map((item) => {
      if (item.type === "taskItem") {
        const box = item.attrs?.state === "DONE" ? "[x]" : "[ ]";
        return `- ${box} ${renderInline(item.content)}`;
      }
      // Nested task lists sit directly inside their parent list.
      return indentContinuation("  " + renderBlock(item), 2);
    })
    .join("\n");
}

function renderTable(node: AdfNode): string {
  const rows = (node.content ?? [])
    .filter((row) => row.type === "tableRow")
    .map((row) => (row.content ?? []).map((cell) => renderBlocks(cell.content).replace(/\s*\n+\s*/g, " ").trim()));
  if (rows.length === 0) return "";

  // GFM tables always need a header row, so the first row is used as one.
  const width = Math.max(...rows.map((row) => row.length));
  const line = (cells: string[]) =>
    `| ${[...cells, ...Array(width - cells.length).fill("")].join(" | ")} |`;
  return [line(rows[0]), line(Array(width).fill("---")), ...rows.slice(1).map(line)].join("\n");
}

function blockquote(text: string): string {
  return text
    .split("\n")
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n");
}

function renderBlock(node: AdfNode): string {
  const attrs = node.attrs ?? {};
  switch (node.type) {
    case "doc":
      return renderBlocks(node.content);
    case "paragraph":
      return renderInline(node.content);
    case "heading": {
      const text = renderInline(node.content);
      const level = Math.min(Math.max(Number(attrs.level) || 1, 1), 6);
      return text ? `${"#".repeat(level)} ${text}` : "";
    }
    case "bulletList":
      return renderList(node.content ?? [], () => "- ");
    case "orderedList": {
      const start = Number(attrs.order) || 1;
      return renderList(node.content ?? [], (i) => `${start + i}. `);
    }
    case "taskList":
      return renderTaskList(node);
    case "codeBlock": {
      const code = (node.content ?? []).map((child) => child.text ?? "").join("");
      const fence = code.includes("```") ? "````" : "```";
      return `${fence}${(attrs.language as string) ?? ""}\n${code}\n${fence}`;
    }
    case "blockquote":
    case "panel":
      return blockquote(renderBlocks(node.content));
    case "rule":
      return "---";
    case "table":
      return renderTable(node);
    case "expand":
    case "nestedExpand": {
      const title = attrs.title ? `**${escapeMarkdown(attrs.title as string)}**` : "";
      return [title, renderBlocks(node.content)].filter(Boolean).join("\n\n");
    }
    case "mediaSingle":
    case "mediaGroup":
    case "media":
      // Attachments need an authenticated Jira session to load, so skip them.
      return "";
    default:
      return node.text !== undefined ? renderInlineNode(node) : renderBlocks(node.content);
  }
}

// Converts Atlassian Document Format (Jira's rich text JSON) to GitHub-flavored Markdown.
export function adfToMarkdown(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  return renderBlock(node as AdfNode);
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
  const description = adfToMarkdown(data.fields?.description);
  console.log(`[jira] ${issueKey} summary="${summary}" desc length=${description.length}`);
  const rawComments = data.fields?.comment?.comments ?? [];
  const comments: JiraComment[] = rawComments.map((c: { author?: { displayName?: string }; body?: unknown; created?: string }) => ({
    author: c.author?.displayName ?? "Unknown",
    body: adfToPlainText(c.body),
    created: c.created ?? "",
  }));

  return { summary, description, comments };
}
