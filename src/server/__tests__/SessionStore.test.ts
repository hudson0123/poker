import { SessionStore } from "../SessionStore";

describe("SessionStore", () => {
  let store: SessionStore;

  beforeEach(() => {
    store = new SessionStore();
  });

  describe("createSession", () => {
    it("creates a session with the host as first participant", () => {
      const session = store.createSession("Sprint 42", "host-id", "Alice");
      expect(session.name).toBe("Sprint 42");
      expect(session.hostId).toBe("host-id");
      expect(session.participants.get("host-id")).toMatchObject({
        id: "host-id",
        name: "Alice",
        isHost: true,
        isSpectator: false,
      });
      expect(session.tickets).toEqual([]);
      expect(session.activeTicketId).toBeNull();
    });
  });

  describe("joinSession", () => {
    it("adds a new participant to an existing session", () => {
      const session = store.createSession("Sprint 42", "host-id", "Alice");
      const participant = store.joinSession(session.id, "user-1", "Bob", "socket-1", false);
      expect(participant).toMatchObject({ id: "user-1", name: "Bob", isHost: false, isSpectator: false });
    });

    it("adds a spectator", () => {
      const session = store.createSession("Sprint 42", "host-id", "Alice");
      const participant = store.joinSession(session.id, "user-2", "Carol", "socket-2", true);
      expect(participant?.isSpectator).toBe(true);
    });

    it("returns null for non-existent session", () => {
      expect(store.joinSession("fake-id", "user-1", "Bob", "socket-1", false)).toBeNull();
    });

    it("reconnects an existing participant with new socketId", () => {
      const session = store.createSession("Sprint 42", "host-id", "Alice");
      store.joinSession(session.id, "user-1", "Bob", "socket-1", false);
      const reconnected = store.reconnectParticipant(session.id, "user-1", "socket-2");
      expect(reconnected?.isConnected).toBe(true);
      expect(store.getSession(session.id)?.participants.get("user-1")?.socketId).toBe("socket-2");
    });
  });

  describe("voting", () => {
    let sessionId: string;

    beforeEach(() => {
      const session = store.createSession("Sprint 42", "host-id", "Alice");
      sessionId = session.id;
      store.joinSession(sessionId, "user-1", "Bob", "socket-1", false);
      const ticket = store.addTicket(sessionId, "TICKET-1: Login");
      store.moveHostTo(sessionId, ticket!.id);
    });

    it("records a vote", () => {
      const session = store.getSession(sessionId)!;
      const ticketId = session.tickets[0].id;
      expect(store.submitVote(sessionId, "user-1", ticketId, 5)).toBe(true);
      expect(session.tickets[0].votes.get("user-1")).toBe(5);
    });

    it("allows changing a vote", () => {
      const session = store.getSession(sessionId)!;
      const ticketId = session.tickets[0].id;
      store.submitVote(sessionId, "user-1", ticketId, 5);
      store.submitVote(sessionId, "user-1", ticketId, 8);
      expect(session.tickets[0].votes.get("user-1")).toBe(8);
    });

    it("clears a vote", () => {
      const session = store.getSession(sessionId)!;
      const ticketId = session.tickets[0].id;
      store.submitVote(sessionId, "user-1", ticketId, 5);
      store.clearVote(sessionId, "user-1", ticketId);
      expect(session.tickets[0].votes.has("user-1")).toBe(false);
    });

    it("rejects votes on non-voting tickets", () => {
      const ticket2 = store.addTicket(sessionId, "TICKET-2: Signup");
      expect(store.submitVote(sessionId, "user-1", ticket2!.id, 5)).toBe(false);
    });

    it("allows special vote values", () => {
      const session = store.getSession(sessionId)!;
      const ticketId = session.tickets[0].id;
      expect(store.submitVote(sessionId, "user-1", ticketId, "?")).toBe(true);
      expect(session.tickets[0].votes.get("user-1")).toBe("?");
    });
  });

  describe("moveHostTo", () => {
    let sessionId: string;
    let first: string;
    let second: string;

    beforeEach(() => {
      const session = store.createSession("Sprint 42", "host-id", "Alice");
      sessionId = session.id;
      store.joinSession(sessionId, "user-1", "Bob", "socket-1", false);
      first = store.addTicket(sessionId, "TICKET-1")!.id;
      second = store.addTicket(sessionId, "TICKET-2")!.id;
    });

    it("opens voting on the ticket the host moves to", () => {
      const result = store.moveHostTo(sessionId, first);
      const session = store.getSession(sessionId)!;
      expect(result?.opened.status).toBe("voting");
      expect(result?.opened.round).toBe(1);
      expect(result?.paused).toBeNull();
      expect(session.activeTicketId).toBe(first);
      expect(session.hostViewingTicketId).toBe(first);
    });

    it("pauses the ticket the host leaves, keeping its votes, and resumes it on return", () => {
      store.moveHostTo(sessionId, first);
      store.submitVote(sessionId, "user-1", first, 5);

      const away = store.moveHostTo(sessionId, second);
      expect(away?.paused?.id).toBe(first);
      expect(away?.paused?.status).toBe("waiting");
      expect(away?.paused?.votes.get("user-1")).toBe(5);

      const back = store.moveHostTo(sessionId, first);
      expect(back?.opened.status).toBe("voting");
      expect(back?.opened.votes.get("user-1")).toBe(5);
      expect(back?.paused?.id).toBe(second);
    });

    it("keeps only the host's ticket open for voting", () => {
      store.moveHostTo(sessionId, first);
      store.moveHostTo(sessionId, second);
      const statuses = store.getSession(sessionId)!.tickets.map((t) => t.status);
      expect(statuses).toEqual(["waiting", "voting"]);
      expect(store.submitVote(sessionId, "user-1", first, 5)).toBe(false);
      expect(store.clearVote(sessionId, "user-1", first)).toBe(false);
    });

    it("leaves a revealed ticket revealed when the host returns to it", () => {
      store.moveHostTo(sessionId, first);
      store.revealVotes(sessionId, first);
      store.moveHostTo(sessionId, second);

      const back = store.moveHostTo(sessionId, first);
      expect(back?.opened.status).toBe("revealed");
      expect(back?.paused?.id).toBe(second);
    });

    it("returns null for an unknown ticket", () => {
      expect(store.moveHostTo(sessionId, "missing")).toBeNull();
    });
  });

  describe("revealIfAllVoted", () => {
    let sessionId: string;
    let ticketId: string;

    beforeEach(() => {
      const session = store.createSession("Sprint 42", "host-id", "Alice");
      sessionId = session.id;
      store.joinSession(sessionId, "user-1", "Bob", "socket-1", false);
      ticketId = store.addTicket(sessionId, "TICKET-1")!.id;
      store.moveHostTo(sessionId, ticketId);
    });

    it("does nothing while an eligible voter hasn't voted", () => {
      store.submitVote(sessionId, "user-1", ticketId, 5);
      expect(store.revealIfAllVoted(sessionId)).toBeNull();
      expect(store.getSession(sessionId)!.tickets[0].status).toBe("voting");
    });

    it("reveals once every connected voter, including the host, has voted", () => {
      store.submitVote(sessionId, "user-1", ticketId, 5);
      store.submitVote(sessionId, "host-id", ticketId, "?");
      const result = store.revealIfAllVoted(sessionId);
      expect(result?.ticket.id).toBe(ticketId);
      expect(result?.ticket.status).toBe("revealed");
    });

    it("ignores spectators and disconnected participants", () => {
      store.joinSession(sessionId, "watcher", "Dana", "socket-2", true);
      store.joinSession(sessionId, "dropped", "Eve", "socket-3", false);
      store.disconnectParticipant("socket-3");
      store.submitVote(sessionId, "user-1", ticketId, 5);
      store.submitVote(sessionId, "host-id", ticketId, 5);
      expect(store.revealIfAllVoted(sessionId)?.ticket.status).toBe("revealed");
    });

    it("does not reveal when nobody is eligible to vote", () => {
      store.disconnectParticipant("socket-1");
      store.getSession(sessionId)!.participants.get("host-id")!.isConnected = false;
      expect(store.revealIfAllVoted(sessionId)).toBeNull();
    });

    it("does not reveal a ticket twice", () => {
      store.submitVote(sessionId, "user-1", ticketId, 5);
      store.submitVote(sessionId, "host-id", ticketId, 5);
      store.revealIfAllVoted(sessionId);
      expect(store.revealIfAllVoted(sessionId)).toBeNull();
    });
  });

  describe("revealVotes", () => {
    it("returns votes with stats and changes status to revealed", () => {
      const session = store.createSession("Sprint 42", "host-id", "Alice");
      store.joinSession(session.id, "user-1", "Bob", "socket-1", false);
      store.joinSession(session.id, "user-2", "Carol", "socket-2", false);
      const ticket = store.addTicket(session.id, "TICKET-1")!;
      store.moveHostTo(session.id, ticket.id);
      store.submitVote(session.id, "user-1", ticket.id, 5);
      store.submitVote(session.id, "user-2", ticket.id, 5);

      const result = store.revealVotes(session.id, ticket.id);
      expect(result?.ticket.status).toBe("revealed");
      expect(result?.stats.isConsensus).toBe(true);
      expect(result?.stats.average).toBe(5);
    });
  });

  describe("resetVoting", () => {
    it("clears votes and increments round", () => {
      const session = store.createSession("Sprint 42", "host-id", "Alice");
      store.joinSession(session.id, "user-1", "Bob", "socket-1", false);
      const ticket = store.addTicket(session.id, "TICKET-1")!;
      store.moveHostTo(session.id, ticket.id);
      store.submitVote(session.id, "user-1", ticket.id, 5);
      store.revealVotes(session.id, ticket.id);

      const reset = store.resetVoting(session.id, ticket.id);
      expect(reset?.status).toBe("voting");
      expect(reset?.round).toBe(2);
      expect(reset?.votes.size).toBe(0);
    });
  });

  describe("serializeSession", () => {
    it("lists who has voted on unrevealed tickets without their values", () => {
      const session = store.createSession("Sprint 42", "host-id", "Alice");
      store.joinSession(session.id, "user-1", "Bob", "socket-1", false);
      const ticket = store.addTicket(session.id, "TICKET-1")!;
      store.moveHostTo(session.id, ticket.id);
      store.submitVote(session.id, "user-1", ticket.id, 5);

      const serialized = store.serializeSession(store.getSession(session.id)!);
      expect(serialized.tickets[0].voterIds).toEqual(["user-1"]);
      expect(serialized.tickets[0].votes).toEqual({});
    });

    it("strips vote values from unrevealed tickets", () => {
      const session = store.createSession("Sprint 42", "host-id", "Alice");
      store.joinSession(session.id, "user-1", "Bob", "socket-1", false);
      const ticket = store.addTicket(session.id, "TICKET-1")!;
      store.moveHostTo(session.id, ticket.id);
      store.submitVote(session.id, "user-1", ticket.id, 5);

      const serialized = store.serializeSession(store.getSession(session.id)!);
      const votingTicket = serialized.tickets[0];
      expect(votingTicket.votes["user-1"]).toBeUndefined();
      expect(Object.keys(votingTicket.votes)).toEqual([]);
    });

    it("includes vote values for revealed tickets", () => {
      const session = store.createSession("Sprint 42", "host-id", "Alice");
      store.joinSession(session.id, "user-1", "Bob", "socket-1", false);
      const ticket = store.addTicket(session.id, "TICKET-1")!;
      store.moveHostTo(session.id, ticket.id);
      store.submitVote(session.id, "user-1", ticket.id, 5);
      store.revealVotes(session.id, ticket.id);

      const serialized = store.serializeSession(store.getSession(session.id)!);
      expect(serialized.tickets[0].votes["user-1"]).toBe(5);
    });
  });

  describe("ticket management", () => {
    it("adds and removes tickets", () => {
      const session = store.createSession("Sprint 42", "host-id", "Alice");
      const ticket = store.addTicket(session.id, "TICKET-1")!;
      expect(session.tickets).toHaveLength(1);
      store.removeTicket(session.id, ticket.id);
      expect(session.tickets).toHaveLength(0);
    });

    it("moves the host to the first remaining ticket when the active one is removed", () => {
      const session = store.createSession("Sprint 42", "host-id", "Alice");
      const first = store.addTicket(session.id, "TICKET-1")!;
      const second = store.addTicket(session.id, "TICKET-2")!;
      store.moveHostTo(session.id, first.id);

      store.removeTicket(session.id, first.id);
      expect(session.activeTicketId).toBe(second.id);
      expect(session.hostViewingTicketId).toBe(second.id);
      expect(session.tickets[0].status).toBe("voting");
    });

    it("bulk adds tickets", () => {
      const session = store.createSession("Sprint 42", "host-id", "Alice");
      const tickets = store.addTicketsBulk(session.id, [
        { title: "First" },
        { title: "Second", jiraUrl: "https://talkiatry.atlassian.net/browse/TA2-1" },
      ]);
      expect(tickets).toHaveLength(2);
      expect(tickets[1].jiraKey).toBe("TA2-1");
    });
  });

  describe("comments", () => {
    it("adds a comment to a ticket", () => {
      const session = store.createSession("Sprint 42", "host-id", "Alice");
      const ticket = store.addTicket(session.id, "TICKET-1")!;
      const comment = store.addComment(session.id, ticket.id, "Alice", "Needs more context");
      expect(comment?.text).toBe("Needs more context");
      expect(comment?.participantName).toBe("Alice");
      expect(session.tickets[0].comments).toHaveLength(1);
    });
  });

  describe("assignedPoints", () => {
    it("records Jira-assigned points on the ticket they were assigned to only", () => {
      const session = store.createSession("Sprint 42", "host-id", "Alice");
      const first = store.addTicket(session.id, "TA2-1 First")!;
      const second = store.addTicket(session.id, "TA2-2 Second")!;

      expect(store.setAssignedPoints(session.id, first.id, 3)).toBe(true);

      const serialized = store.serializeSession(session);
      expect(serialized.tickets.find((t) => t.id === first.id)?.assignedPoints).toBe(3);
      expect(serialized.tickets.find((t) => t.id === second.id)?.assignedPoints).toBeUndefined();
    });

    it("returns false for an unknown ticket", () => {
      const session = store.createSession("Sprint 42", "host-id", "Alice");
      expect(store.setAssignedPoints(session.id, "missing", 3)).toBe(false);
    });
  });

  describe("disconnection", () => {
    it("marks participant as disconnected", () => {
      const session = store.createSession("Sprint 42", "host-id", "Alice");
      // Host needs a socketId too — set via joinSession path
      session.participants.get("host-id")!.socketId = "host-socket";
      store.joinSession(session.id, "user-1", "Bob", "socket-1", false);

      const result = store.disconnectParticipant("socket-1");
      expect(result?.participantId).toBe("user-1");
      expect(session.participants.get("user-1")?.isConnected).toBe(false);
    });
  });

  describe("cleanup", () => {
    it("removes sessions with no connected participants past timeout", () => {
      const session = store.createSession("Sprint 42", "host-id", "Alice");
      // Simulate all participants disconnected 31 minutes ago
      session.participants.get("host-id")!.isConnected = false;
      session.lastActivity = new Date(Date.now() - 31 * 60 * 1000);

      const removed = store.cleanupStaleSessions();
      expect(removed).toBe(1);
      expect(store.getSession(session.id)).toBeUndefined();
    });

    it("does not remove sessions with connected participants", () => {
      const session = store.createSession("Sprint 42", "host-id", "Alice");
      session.participants.get("host-id")!.isConnected = true;
      session.lastActivity = new Date(Date.now() - 31 * 60 * 1000);

      const removed = store.cleanupStaleSessions();
      expect(removed).toBe(0);
      expect(store.getSession(session.id)).toBeDefined();
    });
  });
});
