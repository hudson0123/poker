import { Session } from "./types";
import { computeVoteStats } from "./vote-stats";

export function generateExportMarkdown(session: Session): string {
  const lines: string[] = [];
  lines.push(`# ${session.name}`);
  lines.push("");
  lines.push(`**Participants:** ${session.participants.filter((p) => !p.isSpectator).map((p) => p.name).join(", ")}`);
  lines.push("");

  const participantMap = new Map(session.participants.map((p) => [p.id, p.name]));

  for (const ticket of session.tickets) {
    const label = ticket.jiraKey ? `${ticket.jiraKey}: ${ticket.title}` : ticket.title;
    lines.push(`## ${label}`);
    if (ticket.jiraUrl) lines.push(`[Jira](${ticket.jiraUrl})`);
    lines.push("");

    if (ticket.status === "revealed" && Object.keys(ticket.votes).length > 0) {
      const stats = computeVoteStats(ticket.votes);
      lines.push(`**Estimate:** ${stats.median} (avg: ${stats.average.toFixed(1)}, range: ${stats.low}-${stats.high})${stats.isConsensus ? " ✅ Consensus" : ""}`);
      if (ticket.round > 1) lines.push(`**Rounds:** ${ticket.round}`);
      lines.push("");
      for (const [pid, vote] of Object.entries(ticket.votes)) {
        lines.push(`- ${participantMap.get(pid) ?? pid}: ${vote}`);
      }
    } else {
      lines.push("*Not voted*");
    }

    if (ticket.comments.length > 0) {
      lines.push("");
      lines.push("**Comments:**");
      for (const c of ticket.comments) {
        lines.push(`- **${c.participantName}:** ${c.text}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}
