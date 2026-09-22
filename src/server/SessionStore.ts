import { nanoid } from "nanoid";
import { computeVoteStats } from "@/lib/vote-stats";
import {
  Comment,
  JiraComment,
  JiraConfig,
  Participant,
  Session,
  Ticket,
  VoteStats,
  VoteValue,
  parseJiraKey,
} from "@/lib/types";

export interface ServerParticipant extends Participant {
  socketId: string;
}

export interface ServerTicket extends Omit<Ticket, "votes"> {
  votes: Map<string, VoteValue>;
}

export interface ServerSession {
  id: string;
  name: string;
  hostId: string;
  createdAt: Date;
  tickets: ServerTicket[];
  activeTicketId: string | null;
  hostViewingTicketId: string | null;
  participants: Map<string, ServerParticipant>;
  jiraConfig?: JiraConfig;
  jiraStoryPointsField?: string;
  lastActivity: Date;
}

const STALE_TIMEOUT_MS = 30 * 60 * 1000;

export class SessionStore {
  private sessions = new Map<string, ServerSession>();
  private socketToSession = new Map<string, { sessionId: string; participantId: string }>();

  createSession(name: string, hostParticipantId: string, hostName: string): ServerSession {
    const session: ServerSession = {
      id: nanoid(),
      name,
      hostId: hostParticipantId,
      createdAt: new Date(),
      tickets: [],
      activeTicketId: null,
      hostViewingTicketId: null,
      participants: new Map([
        [
          hostParticipantId,
          {
            id: hostParticipantId,
            name: hostName,
            isHost: true,
            isSpectator: false,
            isConnected: true,
            socketId: "",
          },
        ],
      ]),
      lastActivity: new Date(),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  getSession(id: string): ServerSession | undefined {
    return this.sessions.get(id);
  }

  joinSession(
    sessionId: string,
    participantId: string,
    name: string,
    socketId: string,
    isSpectator: boolean
  ): Participant | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const existing = session.participants.get(participantId);
    if (existing) {
      existing.socketId = socketId;
      existing.isConnected = true;
      existing.name = name;
      this.socketToSession.set(socketId, { sessionId, participantId });
      session.lastActivity = new Date();
      return this.toClientParticipant(existing);
    }

    const participant: ServerParticipant = {
      id: participantId,
      socketId,
      name,
      isHost: false,
      isSpectator,
      isConnected: true,
    };
    session.participants.set(participantId, participant);
    this.socketToSession.set(socketId, { sessionId, participantId });
    session.lastActivity = new Date();
    return this.toClientParticipant(participant);
  }

  reconnectParticipant(sessionId: string, participantId: string, socketId: string): Participant | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    const participant = session.participants.get(participantId);
    if (!participant) return null;

    participant.socketId = socketId;
    participant.isConnected = true;
    this.socketToSession.set(socketId, { sessionId, participantId });
    session.lastActivity = new Date();
    return this.toClientParticipant(participant);
  }

  disconnectParticipant(socketId: string): { sessionId: string; participantId: string } | null {
    const mapping = this.socketToSession.get(socketId);
    if (!mapping) return null;

    const session = this.sessions.get(mapping.sessionId);
    if (session) {
      const participant = session.participants.get(mapping.participantId);
      if (participant) {
        participant.isConnected = false;
      }
      session.lastActivity = new Date();
    }
    this.socketToSession.delete(socketId);
    return mapping;
  }

  submitVote(sessionId: string, participantId: string, ticketId: string, points: VoteValue): boolean {
    const ticket = this.findTicket(sessionId, ticketId);
    if (!ticket || ticket.status !== "voting") return false;
    ticket.votes.set(participantId, points);
    this.touch(sessionId);
    return true;
  }

  clearVote(sessionId: string, participantId: string, ticketId: string): boolean {
    const ticket = this.findTicket(sessionId, ticketId);
    if (!ticket) return false;
    ticket.votes.delete(participantId);
    this.touch(sessionId);
    return true;
  }

  addTicket(sessionId: string, title: string): ServerTicket | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const jiraKey = parseJiraKey(title) ?? undefined;
    const jiraUrl = jiraKey ? `https://talkiatry.atlassian.net/browse/${jiraKey}` : undefined;
    const cleanTitle = jiraKey ? title.replace(jiraKey, "").trim() : title;
    const ticket: ServerTicket = {
      id: nanoid(),
      title: cleanTitle,
      jiraKey,
      jiraUrl,
      status: "waiting",
      votes: new Map(),
      comments: [],
      round: 1,
    };
    session.tickets.push(ticket);
    this.touch(sessionId);
    return ticket;
  }

  addTicketsBulk(sessionId: string, tickets: { title: string }[]): ServerTicket[] {
    return tickets
      .map((t) => this.addTicket(sessionId, t.title))
      .filter((t): t is ServerTicket => t !== null);
  }

  removeTicket(sessionId: string, ticketId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    const idx = session.tickets.findIndex((t) => t.id === ticketId);
    if (idx === -1) return false;
    session.tickets.splice(idx, 1);
    if (session.activeTicketId === ticketId) {
      session.activeTicketId = session.tickets[0]?.id ?? null;
    }
    this.touch(sessionId);
    return true;
  }

  startVoting(sessionId: string, ticketId: string): ServerTicket | null {
    const ticket = this.findTicket(sessionId, ticketId);
    if (!ticket) return null;
    if (ticket.status === "revealed") {
      ticket.votes.clear();
      ticket.round += 1;
    }
    ticket.status = "voting";
    const session = this.sessions.get(sessionId)!;
    session.activeTicketId = ticketId;
    session.hostViewingTicketId = ticketId;
    this.touch(sessionId);
    return ticket;
  }

  setActiveTicket(sessionId: string, ticketId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    if (!session.tickets.some((t) => t.id === ticketId)) return false;
    session.activeTicketId = ticketId;
    session.hostViewingTicketId = ticketId;
    this.touch(sessionId);
    return true;
  }

  setHostViewingTicket(sessionId: string, ticketId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    if (!session.tickets.some((t) => t.id === ticketId)) return false;
    session.hostViewingTicketId = ticketId;
    this.touch(sessionId);
    return true;
  }

  revealVotes(sessionId: string, ticketId: string): { ticket: ServerTicket; stats: VoteStats } | null {
    const ticket = this.findTicket(sessionId, ticketId);
    if (!ticket || ticket.status !== "voting") return null;
    ticket.status = "revealed";
    const votesRecord = Object.fromEntries(ticket.votes);
    const stats = computeVoteStats(votesRecord);
    this.touch(sessionId);
    return { ticket, stats };
  }

  resetVoting(sessionId: string, ticketId: string): ServerTicket | null {
    const ticket = this.findTicket(sessionId, ticketId);
    if (!ticket) return null;
    ticket.status = "voting";
    ticket.votes.clear();
    ticket.round += 1;
    this.touch(sessionId);
    return ticket;
  }

  addComment(sessionId: string, ticketId: string, participantName: string, text: string): Comment | null {
    const ticket = this.findTicket(sessionId, ticketId);
    if (!ticket) return null;
    const comment: Comment = {
      id: nanoid(),
      participantName,
      text,
      timestamp: new Date().toISOString(),
    };
    ticket.comments.push(comment);
    this.touch(sessionId);
    return comment;
  }

  setJiraConfig(sessionId: string, config: JiraConfig): void {
    const session = this.sessions.get(sessionId);
    if (session) session.jiraConfig = config;
  }

  getJiraConfig(sessionId: string): JiraConfig | undefined {
    return this.sessions.get(sessionId)?.jiraConfig;
  }

  setJiraContext(sessionId: string, ticketId: string, summary: string, description: string, comments: JiraComment[]): ServerTicket | null {
    const ticket = this.findTicket(sessionId, ticketId);
    if (!ticket) return null;
    if (summary) ticket.title = summary;
    ticket.jiraDescription = description;
    ticket.jiraComments = comments;
    return ticket;
  }

  isHost(sessionId: string, participantId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session?.hostId === participantId;
  }

  serializeSession(session: ServerSession): Session {
    return {
      id: session.id,
      name: session.name,
      createdAt: session.createdAt.toISOString(),
      activeTicketId: session.activeTicketId,
      hostViewingTicketId: session.hostViewingTicketId,
      jiraConnected: !!session.jiraConfig,
      participants: Array.from(session.participants.values()).map(this.toClientParticipant),
      tickets: session.tickets.map((t) => this.serializeTicket(t)),
    };
  }

  cleanupStaleSessions(): number {
    let removed = 0;
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      const hasConnected = Array.from(session.participants.values()).some((p) => p.isConnected);
      if (!hasConnected && now - session.lastActivity.getTime() > STALE_TIMEOUT_MS) {
        for (const p of session.participants.values()) {
          this.socketToSession.delete(p.socketId);
        }
        this.sessions.delete(id);
        removed++;
      }
    }
    return removed;
  }

  private findTicket(sessionId: string, ticketId: string): ServerTicket | null {
    const session = this.sessions.get(sessionId);
    return session?.tickets.find((t) => t.id === ticketId) ?? null;
  }

  private touch(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) session.lastActivity = new Date();
  }

  private serializeTicket(ticket: ServerTicket): Ticket {
    const votes: Record<string, VoteValue> =
      ticket.status === "revealed" ? Object.fromEntries(ticket.votes) : {};
    return {
      id: ticket.id,
      title: ticket.title,
      jiraKey: ticket.jiraKey,
      jiraUrl: ticket.jiraUrl,
      jiraDescription: ticket.jiraDescription,
      jiraComments: ticket.jiraComments,
      status: ticket.status,
      votes,
      comments: ticket.comments,
      round: ticket.round,
    };
  }

  private toClientParticipant(p: ServerParticipant): Participant {
    return { id: p.id, name: p.name, isHost: p.isHost, isSpectator: p.isSpectator, isConnected: p.isConnected };
  }
}
