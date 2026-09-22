import { parseJiraKey } from "./types";

export function parseBulkImport(text: string): { title: string; jiraUrl?: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const urlMatch = line.match(/(https?:\/\/\S+)/);
      if (urlMatch) {
        const url = urlMatch[1];
        const title = line.replace(url, "").trim();
        if (title) {
          return { title, jiraUrl: url };
        }
        const key = parseJiraKey(url);
        return { title: key || url, jiraUrl: url };
      }
      return { title: line };
    });
}
