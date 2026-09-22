import { Server as SocketIOServer, Socket } from "socket.io";
import { SessionStore } from "./SessionStore";
import { fetchJiraIssue, validateJiraCredentials } from "./jiraClient";
import { ALL_VOTE_VALUES, VoteValue } from "@/lib/types";

interface SocketData {
  sessionId: string;
  participantId: string;
}

export function registerSocketHandlers(io: SocketIOServer, store: SessionStore): void {
  io.on("connection", (socket: Socket) => {
    const data: SocketData = { sessionId: "", participantId: "" };

    socket.on("create-session", (payload: { name: string; participantId: string; hostName: string }, callback) => {
      const session = store.createSession(payload.name, payload.participantId, payload.hostName);
      const host = session.participants.get(payload.participantId)!;
      host.socketId = socket.id;
      data.sessionId = session.id;
      data.participantId = payload.participantId;
      socket.join(session.id);
      callback({ sessionId: session.id });
    });

    socket.on(
      "join-session",
      (payload: { sessionId: string; participantName: string; participantId: string; isSpectator: boolean }) => {
        const existing = store.getSession(payload.sessionId);
        if (!existing) {
          socket.emit("error", { message: "Session not found" });
          return;
        }

        const existingParticipant = existing.participants.get(payload.participantId);
        let participant;
        if (existingParticipant) {
          participant = store.reconnectParticipant(payload.sessionId, payload.participantId, socket.id);
        } else {
          participant = store.joinSession(
            payload.sessionId,
            payload.participantId,
            payload.participantName,
            socket.id,
            payload.isSpectator
          );
        }

        if (!participant) {
          socket.emit("error", { message: "Failed to join session" });
          return;
        }

        data.sessionId = payload.sessionId;
        data.participantId = payload.participantId;
        socket.join(payload.sessionId);

        socket.emit("session-state", store.serializeSession(existing));
        socket.to(payload.sessionId).emit("participant-joined", participant);
      }
    );

    socket.on("submit-vote", (payload: { ticketId: string; points: VoteValue }) => {
      if (!data.sessionId) return;
      if (!ALL_VOTE_VALUES.includes(payload.points)) return;
      const session = store.getSession(data.sessionId);
      const participant = session?.participants.get(data.participantId);
      if (!participant || participant.isSpectator) return;
      const ok = store.submitVote(data.sessionId, data.participantId, payload.ticketId, payload.points);
      if (ok) {
        io.to(data.sessionId).emit("vote-updated", {
          ticketId: payload.ticketId,
          participantId: data.participantId,
          hasVoted: true,
        });
      }
    });

    socket.on("clear-vote", (payload: { ticketId: string }) => {
      if (!data.sessionId) return;
      const ok = store.clearVote(data.sessionId, data.participantId, payload.ticketId);
      if (ok) {
        io.to(data.sessionId).emit("vote-updated", {
          ticketId: payload.ticketId,
          participantId: data.participantId,
          hasVoted: false,
        });
      }
    });

    socket.on("add-comment", (payload: { ticketId: string; text: string }) => {
      if (!data.sessionId) return;
      const session = store.getSession(data.sessionId);
      const participant = session?.participants.get(data.participantId);
      if (!participant) return;
      const comment = store.addComment(data.sessionId, payload.ticketId, participant.name, payload.text);
      if (comment) {
        io.to(data.sessionId).emit("comment-added", { ticketId: payload.ticketId, comment });
      }
    });

    // Host-only events
    function requireHost(): boolean {
      return store.isHost(data.sessionId, data.participantId);
    }

    socket.on("add-ticket", (payload: { title: string; jiraUrl?: string }) => {
      if (!requireHost()) return;
      const ticket = store.addTicket(data.sessionId, payload.title, payload.jiraUrl);
      if (ticket) {
        const serialized = store.serializeSession(store.getSession(data.sessionId)!);
        const clientTicket = serialized.tickets.find((t) => t.id === ticket.id);
        io.to(data.sessionId).emit("ticket-added", clientTicket);
        fetchJiraContextIfNeeded(data.sessionId, ticket.id, ticket.jiraKey);
      }
    });

    socket.on("add-tickets-bulk", (payload: { tickets: { title: string; jiraUrl?: string }[] }) => {
      if (!requireHost()) return;
      const tickets = store.addTicketsBulk(data.sessionId, payload.tickets);
      if (tickets.length > 0) {
        const serialized = store.serializeSession(store.getSession(data.sessionId)!);
        const clientTickets = serialized.tickets.filter((t) => tickets.some((st) => st.id === t.id));
        io.to(data.sessionId).emit("tickets-added", clientTickets);
        for (const ticket of tickets) {
          fetchJiraContextIfNeeded(data.sessionId, ticket.id, ticket.jiraKey);
        }
      }
    });

    socket.on("remove-ticket", (payload: { ticketId: string }) => {
      if (!requireHost()) return;
      const wasActive = store.getSession(data.sessionId)?.activeTicketId === payload.ticketId;
      if (store.removeTicket(data.sessionId, payload.ticketId)) {
        io.to(data.sessionId).emit("ticket-removed", { ticketId: payload.ticketId });
        if (wasActive) {
          const newActiveTicketId = store.getSession(data.sessionId)?.activeTicketId ?? null;
          if (newActiveTicketId) {
            io.to(data.sessionId).emit("active-ticket-changed", { ticketId: newActiveTicketId });
          }
        }
      }
    });

    socket.on("start-voting", (payload: { ticketId: string }) => {
      if (!requireHost()) return;
      const ticket = store.startVoting(data.sessionId, payload.ticketId);
      if (ticket) {
        const serialized = store.serializeSession(store.getSession(data.sessionId)!);
        const clientTicket = serialized.tickets.find((t) => t.id === ticket.id);
        io.to(data.sessionId).emit("ticket-updated", clientTicket);
        io.to(data.sessionId).emit("active-ticket-changed", { ticketId: payload.ticketId });
      }
    });

    socket.on("reveal-votes", (payload: { ticketId: string }) => {
      if (!requireHost()) return;
      const result = store.revealVotes(data.sessionId, payload.ticketId);
      if (result) {
        io.to(data.sessionId).emit("votes-revealed", {
          ticketId: payload.ticketId,
          votes: Object.fromEntries(result.ticket.votes),
          stats: result.stats,
        });
      }
    });

    socket.on("reset-voting", (payload: { ticketId: string }) => {
      if (!requireHost()) return;
      const ticket = store.resetVoting(data.sessionId, payload.ticketId);
      if (ticket) {
        io.to(data.sessionId).emit("voting-reset", { ticketId: payload.ticketId, round: ticket.round });
      }
    });

    socket.on("start-timer", (payload: { seconds: number }) => {
      if (!requireHost()) return;
      const endsAt = new Date(Date.now() + payload.seconds * 1000).toISOString();
      io.to(data.sessionId).emit("timer-started", { endsAt });
    });

    socket.on("stop-timer", () => {
      if (!requireHost()) return;
      io.to(data.sessionId).emit("timer-stopped", {});
    });

    socket.on("configure-jira", async (payload: { baseUrl: string; email: string; apiToken: string }) => {
      if (!requireHost()) return;
      const config = { baseUrl: payload.baseUrl, email: payload.email, apiToken: payload.apiToken };
      const valid = await validateJiraCredentials(config);
      if (valid) {
        store.setJiraConfig(data.sessionId, config);
        io.to(data.sessionId).emit("jira-configured", { connected: true });
        // Fetch context for any existing tickets with Jira keys
        const session = store.getSession(data.sessionId);
        if (session) {
          for (const ticket of session.tickets) {
            if (ticket.jiraKey && !ticket.jiraDescription) {
              fetchJiraContextIfNeeded(data.sessionId, ticket.id, ticket.jiraKey);
            }
          }
        }
      } else {
        socket.emit("jira-error", { message: "Invalid Jira credentials. Check your base URL, email, and API token." });
      }
    });

    async function fetchJiraContextIfNeeded(sessionId: string, ticketId: string, jiraKey?: string) {
      if (!jiraKey) return;
      const config = store.getJiraConfig(sessionId);
      if (!config) return;
      try {
        const { description, comments } = await fetchJiraIssue(config, jiraKey);
        store.setJiraContext(sessionId, ticketId, description, comments);
        io.to(sessionId).emit("jira-context-loaded", { ticketId, description, comments });
      } catch (err) {
        io.to(sessionId).emit("jira-error", {
          ticketId,
          message: `Failed to fetch Jira issue ${jiraKey}: ${(err as Error).message}`,
        });
      }
    }

    socket.on("disconnect", () => {
      const result = store.disconnectParticipant(socket.id);
      if (result) {
        io.to(result.sessionId).emit("participant-left", { participantId: result.participantId });
      }
    });
  });
}
