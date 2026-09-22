export type VoteValue = number | "?" | "☕";
export type TicketStatus = "waiting" | "voting" | "revealed";

export const POINT_VALUES = [1, 2, 3, 5, 8, 13, 21] as const;
export const SPECIAL_VALUES = ["?", "☕"] as const;
export const ALL_VOTE_VALUES: readonly VoteValue[] = [...POINT_VALUES, ...SPECIAL_VALUES];

export interface Session {
  id: string;
  name: string;
  createdAt: string;
  tickets: Ticket[];
  activeTicketId: string | null;
  participants: Participant[];
  jiraConnected: boolean;
}

export interface Ticket {
  id: string;
  title: string;
  jiraKey?: string;
  jiraUrl?: string;
  jiraDescription?: string;
  jiraComments?: JiraComment[];
  status: TicketStatus;
  votes: Record<string, VoteValue>;
  comments: Comment[];
  round: number;
}

export interface JiraComment {
  author: string;
  body: string;
  created: string;
}

export interface Participant {
  id: string;
  name: string;
  isHost: boolean;
  isSpectator: boolean;
  isConnected: boolean;
}

export interface Comment {
  id: string;
  participantName: string;
  text: string;
  timestamp: string;
}

export interface VoteStats {
  average: number;
  median: number;
  high: number;
  low: number;
  outlierParticipantIds: string[];
  isConsensus: boolean;
}

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export function parseJiraKey(input: string): string | null {
  const urlMatch = input.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)/);
  if (urlMatch) return urlMatch[1];
  const bareMatch = input.match(/^([A-Z][A-Z0-9]+-\d+)$/);
  if (bareMatch) return bareMatch[1];
  return null;
}

export function buildJiraUrl(baseUrl: string, key: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const protocol = base.startsWith("http") ? "" : "https://";
  return `${protocol}${base}/browse/${key}`;
}
