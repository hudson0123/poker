import { Server as SocketIOServer, Socket } from "socket.io";
import { ServerTicket, SessionStore } from "./SessionStore";
import { fetchJiraIssue, validateJiraCredentials, assignStoryPoints, getStoryPointsFieldId, fetchRefineTickets } from "./jiraClient";
import { ALL_VOTE_VALUES, VoteStats, VoteValue } from "@/lib/types";

interface SocketData {
  sessionId: string;
  participantId: string;
}

export function registerSocketHandlers(io: SocketIOServer, store: SessionStore): void {
  async function fetchJiraContextIfNeeded(sessionId: string, ticketId: string, jiraKey?: string) {
    if (!jiraKey) return;
    const config = store.getJiraConfig(sessionId);
    if (!config) return;
    try {
      const { summary, description, comments } = await fetchJiraIssue(config, jiraKey);
      store.setJiraContext(sessionId, ticketId, summary, description, comments);
      const session = store.getSession(sessionId);
      const serialized = session ? store.serializeSession(session) : null;
      const clientTicket = serialized?.tickets.find((t) => t.id === ticketId);
      if (clientTicket) io.to(sessionId).emit("ticket-updated", clientTicket);
      io.to(sessionId).emit("jira-context-loaded", { ticketId, description, comments });
    } catch (err) {
      io.to(sessionId).emit("jira-error", {
        ticketId,
        message: `Failed to fetch Jira issue ${jiraKey}: ${(err as Error).message}`,
      });
    }
  }

  async function importRefineTickets(sessionId: string) {
    const session = store.getSession(sessionId);
    const config = store.getJiraConfig(sessionId);
    console.log(`[refine] importRefineTickets: session=${!!session} config=${!!config}`);
    if (!session || !config) return;
    try {
      const refineTickets = await fetchRefineTickets(config);
      console.log(`[refine] fetched ${refineTickets.length} refine tickets:`, refineTickets.map((t) => t.key));
      const existingKeys = new Set(session.tickets.map((t) => t.jiraKey).filter(Boolean));
      console.log(`[refine] existing keys:`, [...existingKeys]);
      const newTickets = refineTickets
        .filter((t) => !existingKeys.has(t.key))
        .map((t) => ({ title: `${t.key} ${t.summary}` }));
      console.log(`[refine] new tickets to add: ${newTickets.length}`);
      if (newTickets.length === 0) return;
      const added = store.addTicketsBulk(sessionId, newTickets);
      if (added.length > 0) {
        const serialized = store.serializeSession(store.getSession(sessionId)!);
        const clientTickets = serialized.tickets.filter((t) => added.some((a) => a.id === t.id));
        io.to(sessionId).emit("tickets-added", clientTickets);
        for (const ticket of added) {
          fetchJiraContextIfNeeded(sessionId, ticket.id, ticket.jiraKey);
        }
      }
    } catch (err) {
      console.error(`[refine] error:`, err);
    }
  }

  function emitTicket(sessionId: string, ticketId: string) {
    const session = store.getSession(sessionId);
    const clientTicket = session ? store.serializeSession(session).tickets.find((t) => t.id === ticketId) : undefined;
    if (clientTicket) io.to(sessionId).emit("ticket-updated", clientTicket);
  }

  function emitReveal(sessionId: string, result: { ticket: ServerTicket; stats: VoteStats }) {
    io.to(sessionId).emit("votes-revealed", {
      ticketId: result.ticket.id,
      votes: Object.fromEntries(result.ticket.votes),
      stats: result.stats,
    });
  }

  // Ends voting automatically once every eligible voter has voted. Called after
  // anything that can complete the set: a vote, a disconnect, or resuming a ticket.
  function autoRevealIfComplete(sessionId: string) {
    const result = store.revealIfAllVoted(sessionId);
    if (result) emitReveal(sessionId, result);
  }

  function moveHost(sessionId: string, ticketId: string) {
    const moved = store.moveHostTo(sessionId, ticketId);
    if (!moved) return;
    if (moved.paused) emitTicket(sessionId, moved.paused.id);
    emitTicket(sessionId, moved.opened.id);
    io.to(sessionId).emit("active-ticket-changed", { ticketId });
    autoRevealIfComplete(sessionId);
  }

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

        // If host is joining a Jira-connected session, sync refine tickets
        if (participant.isHost && store.getJiraConfig(payload.sessionId)) {
          importRefineTickets(payload.sessionId);
        }
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
        autoRevealIfComplete(data.sessionId);
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

    socket.on("add-ticket", (payload: { title: string }) => {
      if (!requireHost()) return;
      const ticket = store.addTicket(data.sessionId, payload.title);
      if (ticket) {
        const serialized = store.serializeSession(store.getSession(data.sessionId)!);
        const clientTicket = serialized.tickets.find((t) => t.id === ticket.id);
        io.to(data.sessionId).emit("ticket-added", clientTicket);
        fetchJiraContextIfNeeded(data.sessionId, ticket.id, ticket.jiraKey);
      }
    });

    socket.on("add-tickets-bulk", (payload: { tickets: { title: string }[] }) => {
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
            emitTicket(data.sessionId, newActiveTicketId);
            io.to(data.sessionId).emit("active-ticket-changed", { ticketId: newActiveTicketId });
            autoRevealIfComplete(data.sessionId);
          }
        }
      }
    });

    // Voting follows the host: wherever the host goes, that ticket opens for voting.
    socket.on("set-active-ticket", (payload: { ticketId: string }) => {
      if (!requireHost()) return;
      moveHost(data.sessionId, payload.ticketId);
    });

    socket.on("reveal-votes", (payload: { ticketId: string }) => {
      if (!requireHost()) return;
      const result = store.revealVotes(data.sessionId, payload.ticketId);
      if (result) emitReveal(data.sessionId, result);
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

    socket.on("sync-refine-tickets", async () => {
      if (!requireHost()) return;
      await importRefineTickets(data.sessionId);
    });

    socket.on("assign-points", async (payload: { ticketId: string; points: number }) => {
      if (!requireHost()) return;
      const config = store.getJiraConfig(data.sessionId);
      const session = store.getSession(data.sessionId);
      const ticket = session?.tickets.find((t) => t.id === payload.ticketId);
      if (!config || !ticket?.jiraKey || !session) return;

      // Discover and cache the story points field ID once per session
      if (!session.jiraStoryPointsField) {
        session.jiraStoryPointsField = await getStoryPointsFieldId(config, ticket.jiraKey);
      }

      const fieldId = session.jiraStoryPointsField;
      console.log(`[jira] assigning ${payload.points} pts to ${ticket.jiraKey} via field "${fieldId}"`);

      try {
        await assignStoryPoints(config, ticket.jiraKey, payload.points, fieldId);
        store.setAssignedPoints(data.sessionId, payload.ticketId, payload.points);
        io.to(data.sessionId).emit("points-assigned", { ticketId: payload.ticketId, points: payload.points, fieldId });
      } catch (err) {
        socket.emit("jira-error", { ticketId: payload.ticketId, message: `Failed to assign points: ${(err as Error).message}` });
      }
    });

    socket.on("configure-jira", async (payload: { baseUrl: string; email: string; apiToken: string }) => {
      if (!requireHost()) return;
      const config = { baseUrl: payload.baseUrl, email: payload.email, apiToken: payload.apiToken };
      const valid = await validateJiraCredentials(config);
      if (valid) {
        store.setJiraConfig(data.sessionId, config);
        io.to(data.sessionId).emit("jira-configured", { connected: true });

        const session = store.getSession(data.sessionId);
        if (session) {
          // Fetch context for any existing tickets with Jira keys
          for (const ticket of session.tickets) {
            if (ticket.jiraKey && !ticket.jiraDescription) {
              fetchJiraContextIfNeeded(data.sessionId, ticket.id, ticket.jiraKey);
            }
          }

          // Auto-import backlog tickets labeled 'refine'
          importRefineTickets(data.sessionId);
        }
      } else {
        socket.emit("jira-error", { message: "Invalid Jira credentials. Check your base URL, email, and API token." });
      }
    });

    socket.on("disconnect", () => {
      const result = store.disconnectParticipant(socket.id);
      if (result) {
        io.to(result.sessionId).emit("participant-left", { participantId: result.participantId });
        autoRevealIfComplete(result.sessionId);
      }
    });
  });
}
