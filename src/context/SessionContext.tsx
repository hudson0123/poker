"use client";

import React, { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState } from "react";
import { getParticipantId, getSocket } from "@/lib/socket";
import { Comment, JiraComment, Participant, Session, Ticket, VoteStats, VoteValue } from "@/lib/types";

interface SessionState {
  session: Session | null;
  viewingTicketId: string | null;
  timerEndsAt: string | null;
  error: string | null;
}

type SessionAction =
  | { type: "SET_SESSION"; session: Session }
  | { type: "SET_ERROR"; message: string }
  | { type: "PARTICIPANT_JOINED"; participant: Participant }
  | { type: "PARTICIPANT_LEFT"; participantId: string }
  | { type: "VOTE_UPDATED"; ticketId: string; participantId: string; hasVoted: boolean }
  | { type: "VOTES_REVEALED"; ticketId: string; votes: Record<string, VoteValue>; stats: VoteStats }
  | { type: "TICKET_ADDED"; ticket: Ticket }
  | { type: "TICKETS_ADDED"; tickets: Ticket[] }
  | { type: "TICKET_REMOVED"; ticketId: string }
  | { type: "TICKET_UPDATED"; ticket: Ticket }
  | { type: "TICKETS_REORDERED"; ticketIds: string[] }
  | { type: "VOTING_RESET"; ticketId: string; round: number }
  | { type: "COMMENT_ADDED"; ticketId: string; comment: Comment }
  | { type: "ACTIVE_TICKET_CHANGED"; ticketId: string }
  | { type: "SET_VIEWING_TICKET"; ticketId: string }
  | { type: "TIMER_STARTED"; endsAt: string }
  | { type: "TIMER_STOPPED" }
  | { type: "JIRA_CONFIGURED"; connected: boolean }
  | { type: "JIRA_CONTEXT_LOADED"; ticketId: string; description: string; comments: JiraComment[] };

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  const { session } = state;

  switch (action.type) {
    case "SET_SESSION":
      return {
        ...state,
        session: action.session,
        viewingTicketId: state.viewingTicketId ?? action.session.activeTicketId,
      };

    case "SET_ERROR":
      return { ...state, error: action.message };

    case "PARTICIPANT_JOINED":
      if (!session) return state;
      return {
        ...state,
        session: {
          ...session,
          participants: [...session.participants.filter((p) => p.id !== action.participant.id), action.participant],
        },
      };

    case "PARTICIPANT_LEFT":
      if (!session) return state;
      return {
        ...state,
        session: {
          ...session,
          participants: session.participants.map((p) =>
            p.id === action.participantId ? { ...p, isConnected: false } : p
          ),
        },
      };

    case "VOTE_UPDATED":
      if (!session) return state;
      return {
        ...state,
        session: {
          ...session,
          tickets: session.tickets.map((t) => {
            if (t.id !== action.ticketId) return t;
            const votes = { ...t.votes };
            if (action.hasVoted) {
              votes[action.participantId] = 0 as VoteValue; // placeholder — real value hidden
            } else {
              delete votes[action.participantId];
            }
            return { ...t, votes };
          }),
        },
      };

    case "VOTES_REVEALED":
      if (!session) return state;
      return {
        ...state,
        session: {
          ...session,
          tickets: session.tickets.map((t) =>
            t.id === action.ticketId ? { ...t, status: "revealed" as const, votes: action.votes } : t
          ),
        },
      };

    case "TICKET_ADDED":
      if (!session) return state;
      return { ...state, session: { ...session, tickets: [...session.tickets, action.ticket] } };

    case "TICKETS_ADDED":
      if (!session) return state;
      return { ...state, session: { ...session, tickets: [...session.tickets, ...action.tickets] } };

    case "TICKET_REMOVED":
      if (!session) return state;
      return {
        ...state,
        session: { ...session, tickets: session.tickets.filter((t) => t.id !== action.ticketId) },
        viewingTicketId: state.viewingTicketId === action.ticketId ? session.activeTicketId : state.viewingTicketId,
      };

    case "TICKET_UPDATED":
      if (!session) return state;
      return {
        ...state,
        session: {
          ...session,
          tickets: session.tickets.map((t) => (t.id === action.ticket.id ? action.ticket : t)),
        },
      };

    case "TICKETS_REORDERED":
      if (!session) return state;
      return {
        ...state,
        session: {
          ...session,
          tickets: action.ticketIds
            .map((id) => session.tickets.find((t) => t.id === id))
            .filter((t): t is Ticket => !!t),
        },
      };

    case "VOTING_RESET":
      if (!session) return state;
      return {
        ...state,
        session: {
          ...session,
          tickets: session.tickets.map((t) =>
            t.id === action.ticketId ? { ...t, status: "voting" as const, votes: {}, round: action.round } : t
          ),
        },
      };

    case "COMMENT_ADDED":
      if (!session) return state;
      return {
        ...state,
        session: {
          ...session,
          tickets: session.tickets.map((t) =>
            t.id === action.ticketId ? { ...t, comments: [...t.comments, action.comment] } : t
          ),
        },
      };

    case "ACTIVE_TICKET_CHANGED":
      if (!session) return state;
      return {
        ...state,
        session: { ...session, activeTicketId: action.ticketId },
      };

    case "SET_VIEWING_TICKET":
      return { ...state, viewingTicketId: action.ticketId };

    case "TIMER_STARTED":
      return { ...state, timerEndsAt: action.endsAt };

    case "TIMER_STOPPED":
      return { ...state, timerEndsAt: null };

    case "JIRA_CONFIGURED":
      if (!session) return state;
      return { ...state, session: { ...session, jiraConnected: action.connected } };

    case "JIRA_CONTEXT_LOADED":
      if (!session) return state;
      return {
        ...state,
        session: {
          ...session,
          tickets: session.tickets.map((t) =>
            t.id === action.ticketId
              ? { ...t, jiraDescription: action.description, jiraComments: action.comments }
              : t
          ),
        },
      };

    default:
      return state;
  }
}

interface SessionContextValue {
  session: Session | null;
  currentTicket: Ticket | null;
  viewingTicketId: string | null;
  myParticipantId: string;
  isHost: boolean;
  timerEndsAt: string | null;
  revealedStats: Record<string, VoteStats>;
  error: string | null;
  setViewingTicketId: (id: string) => void;
  emit: (event: string, payload?: unknown) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface SessionProviderProps {
  sessionId: string;
  participantName: string;
  isSpectator: boolean;
  children: React.ReactNode;
}

export function SessionProvider({ sessionId, participantName, isSpectator, children }: SessionProviderProps) {
  const [state, dispatch] = useReducer(sessionReducer, {
    session: null,
    viewingTicketId: null,
    timerEndsAt: null,
    error: null,
  });
  const [participantId] = useState(() => getParticipantId());
  const revealedStatsRef = useRef<Record<string, VoteStats>>({});
  const [revealedStats, setRevealedStats] = useState<Record<string, VoteStats>>({});

  useEffect(() => {
    const socket = getSocket();

    // All listeners — including "session-state", the one-time initial sync —
    // must be registered before join-session is emitted. If a separate
    // component joined first and waited for that event before mounting this
    // provider, this provider's own listener would register too late and
    // permanently miss the only session-state event it will ever receive.
    socket.on("session-state", (session: Session) => {
      dispatch({ type: "SET_SESSION", session });
    });
    socket.on("participant-joined", (participant: Participant) => {
      dispatch({ type: "PARTICIPANT_JOINED", participant });
    });
    socket.on("participant-left", ({ participantId }: { participantId: string }) => {
      dispatch({ type: "PARTICIPANT_LEFT", participantId });
    });
    socket.on("vote-updated", (data: { ticketId: string; participantId: string; hasVoted: boolean }) => {
      dispatch({ type: "VOTE_UPDATED", ...data });
    });
    socket.on("votes-revealed", (data: { ticketId: string; votes: Record<string, VoteValue>; stats: VoteStats }) => {
      revealedStatsRef.current = { ...revealedStatsRef.current, [data.ticketId]: data.stats };
      setRevealedStats({ ...revealedStatsRef.current });
      dispatch({ type: "VOTES_REVEALED", ticketId: data.ticketId, votes: data.votes, stats: data.stats });
    });
    socket.on("ticket-added", (ticket: Ticket) => {
      dispatch({ type: "TICKET_ADDED", ticket });
    });
    socket.on("tickets-added", (tickets: Ticket[]) => {
      dispatch({ type: "TICKETS_ADDED", tickets });
    });
    socket.on("ticket-removed", ({ ticketId }: { ticketId: string }) => {
      dispatch({ type: "TICKET_REMOVED", ticketId });
    });
    socket.on("ticket-updated", (ticket: Ticket) => {
      dispatch({ type: "TICKET_UPDATED", ticket });
    });
    socket.on("tickets-reordered", ({ ticketIds }: { ticketIds: string[] }) => {
      dispatch({ type: "TICKETS_REORDERED", ticketIds });
    });
    socket.on("voting-reset", (data: { ticketId: string; round: number }) => {
      delete revealedStatsRef.current[data.ticketId];
      setRevealedStats({ ...revealedStatsRef.current });
      dispatch({ type: "VOTING_RESET", ...data });
    });
    socket.on("comment-added", (data: { ticketId: string; comment: Comment }) => {
      dispatch({ type: "COMMENT_ADDED", ...data });
    });
    socket.on("active-ticket-changed", ({ ticketId }: { ticketId: string }) => {
      dispatch({ type: "ACTIVE_TICKET_CHANGED", ticketId });
    });
    socket.on("timer-started", ({ endsAt }: { endsAt: string }) => {
      dispatch({ type: "TIMER_STARTED", endsAt });
    });
    socket.on("timer-stopped", () => {
      dispatch({ type: "TIMER_STOPPED" });
    });
    socket.on("jira-configured", ({ connected }: { connected: boolean }) => {
      dispatch({ type: "JIRA_CONFIGURED", connected });
    });
    socket.on("jira-context-loaded", (data: { ticketId: string; description: string; comments: JiraComment[] }) => {
      dispatch({ type: "JIRA_CONTEXT_LOADED", ...data });
    });
    socket.on("error", (data: { message: string }) => {
      dispatch({ type: "SET_ERROR", message: data.message });
    });

    const join = () => {
      socket.emit("join-session", { sessionId, participantName, participantId, isSpectator });
    };
    socket.on("connect", join);
    if (socket.connected) {
      join();
    } else {
      socket.connect();
    }

    return () => {
      socket.removeAllListeners();
    };
  }, [sessionId, participantName, participantId, isSpectator]);

  const setViewingTicketId = useCallback((ticketId: string) => {
    dispatch({ type: "SET_VIEWING_TICKET", ticketId });
  }, []);

  const emit = useCallback((event: string, payload?: unknown) => {
    getSocket().emit(event, payload);
  }, []);

  const isHost = state.session?.hostId === participantId;
  const currentTicket = state.session?.tickets.find((t) => t.id === state.viewingTicketId) ?? null;

  return (
    <SessionContext.Provider
      value={{
        session: state.session,
        currentTicket,
        viewingTicketId: state.viewingTicketId,
        myParticipantId: participantId,
        isHost,
        timerEndsAt: state.timerEndsAt,
        revealedStats,
        error: state.error,
        setViewingTicketId,
        emit,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
