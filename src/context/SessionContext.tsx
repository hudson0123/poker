"use client";

import React, { createContext, useCallback, useContext, useEffect, useReducer, useState } from "react";
import { getParticipantId, getSocket } from "@/lib/socket";
import { Comment, JiraComment, Participant, Session, Ticket, VoteStats, VoteValue } from "@/lib/types";

interface SessionState {
  session: Session | null;
  viewingTicketId: string | null;
  timerEndsAt: string | null;
  error: string | null;
  jiraError: string | null;
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
  | { type: "VOTING_RESET"; ticketId: string; round: number }
  | { type: "COMMENT_ADDED"; ticketId: string; comment: Comment }
  | { type: "ACTIVE_TICKET_CHANGED"; ticketId: string }
  | { type: "SET_VIEWING_TICKET"; ticketId: string }
  | { type: "TIMER_STARTED"; endsAt: string }
  | { type: "TIMER_STOPPED" }
  | { type: "JIRA_CONFIGURED"; connected: boolean }
  | { type: "JIRA_CONTEXT_LOADED"; ticketId: string; description: string; comments: JiraComment[] }
  | { type: "POINTS_ASSIGNED"; ticketId: string; points: number }
  | { type: "SET_JIRA_ERROR"; message: string };

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  const { session } = state;

  switch (action.type) {
    case "SET_SESSION":
      return {
        ...state,
        session: action.session,
        viewingTicketId: state.viewingTicketId ?? action.session.activeTicketId,
        error: null,
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
            const others = t.voterIds.filter((id) => id !== action.participantId);
            return { ...t, voterIds: action.hasVoted ? [...others, action.participantId] : others };
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

    case "VOTING_RESET":
      if (!session) return state;
      return {
        ...state,
        session: {
          ...session,
          tickets: session.tickets.map((t) =>
            t.id === action.ticketId
              ? { ...t, status: "voting" as const, votes: {}, voterIds: [], round: action.round }
              : t
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
        session: { ...session, activeTicketId: action.ticketId, hostViewingTicketId: action.ticketId },
        viewingTicketId: action.ticketId,
      };

    case "SET_VIEWING_TICKET":
      return { ...state, viewingTicketId: action.ticketId };

    case "TIMER_STARTED":
      return { ...state, timerEndsAt: action.endsAt };

    case "TIMER_STOPPED":
      return { ...state, timerEndsAt: null };

    case "JIRA_CONFIGURED":
      if (!session) return state;
      return {
        ...state,
        session: { ...session, jiraConnected: action.connected },
        jiraError: action.connected ? null : state.jiraError,
      };

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

    case "POINTS_ASSIGNED":
      if (!session) return state;
      return {
        ...state,
        session: {
          ...session,
          tickets: session.tickets.map((t) =>
            t.id === action.ticketId ? { ...t, assignedPoints: action.points } : t
          ),
        },
      };

    case "SET_JIRA_ERROR":
      return { ...state, jiraError: action.message };

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
  error: string | null;
  jiraError: string | null;
  isReconnecting: boolean;
  myVote: VoteValue | undefined;
  amSpectator: boolean;
  castVote: (value: VoteValue) => void;
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
    jiraError: null,
  });
  const [participantId] = useState(() => getParticipantId());

  // The server never sends real vote values back to clients until a ticket is
  // revealed (see SessionStore.serializeSession) — so the local voter is the
  // only source of truth for their own selection while voting is in progress.
  // This lives here (rather than in VotingArea) so both VotingArea's cards and
  // the page-level keyboard shortcuts read/write the same selection. It's keyed
  // by ticket and round so a vote is still highlighted when the host leaves a
  // ticket mid-vote and later comes back to it.
  const [myLocalVotes, setMyLocalVotes] = useState<Record<string, VoteValue>>({});
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    // All listeners — including "session-state", the one-time initial sync —
    // must be registered before join-session is emitted. If a separate
    // component joined first and waited for that event before mounting this
    // provider, this provider's own listener would register too late and
    // permanently miss the only session-state event it will ever receive.
    //
    // Handlers are named (not inline) and cleaned up individually via
    // socket.off(event, handler) rather than removeAllListeners() — the
    // socket is a shared module-level singleton, so a blanket
    // removeAllListeners() on unmount would silently destroy listeners
    // any other mounted consumer of the socket may have registered.
    const onSessionState = (session: Session) => {
      setIsReconnecting(false);
      dispatch({ type: "SET_SESSION", session });
    };
    // Socket.io's "connect" event (see `join` below) already re-emits
    // join-session on reconnect using the real participantName — this just
    // surfaces a non-blocking UI signal for the gap between disconnect and
    // the next session-state sync.
    const onDisconnect = () => setIsReconnecting(true);
    const onParticipantJoined = (participant: Participant) => dispatch({ type: "PARTICIPANT_JOINED", participant });
    const onParticipantLeft = ({ participantId }: { participantId: string }) =>
      dispatch({ type: "PARTICIPANT_LEFT", participantId });
    const onVoteUpdated = (data: { ticketId: string; participantId: string; hasVoted: boolean }) =>
      dispatch({ type: "VOTE_UPDATED", ...data });
    const onVotesRevealed = (data: { ticketId: string; votes: Record<string, VoteValue>; stats: VoteStats }) => {
      dispatch({ type: "VOTES_REVEALED", ticketId: data.ticketId, votes: data.votes, stats: data.stats });
    };
    const onTicketAdded = (ticket: Ticket) => dispatch({ type: "TICKET_ADDED", ticket });
    const onTicketsAdded = (tickets: Ticket[]) => dispatch({ type: "TICKETS_ADDED", tickets });
    const onTicketRemoved = ({ ticketId }: { ticketId: string }) => dispatch({ type: "TICKET_REMOVED", ticketId });
    const onTicketUpdated = (ticket: Ticket) => dispatch({ type: "TICKET_UPDATED", ticket });
    const onVotingReset = (data: { ticketId: string; round: number }) => {
      dispatch({ type: "VOTING_RESET", ...data });
    };
    const onCommentAdded = (data: { ticketId: string; comment: Comment }) =>
      dispatch({ type: "COMMENT_ADDED", ...data });
    const onActiveTicketChanged = ({ ticketId }: { ticketId: string }) =>
      dispatch({ type: "ACTIVE_TICKET_CHANGED", ticketId });
    const onTimerStarted = ({ endsAt }: { endsAt: string }) => dispatch({ type: "TIMER_STARTED", endsAt });
    const onTimerStopped = () => dispatch({ type: "TIMER_STOPPED" });
    const onJiraConfigured = ({ connected }: { connected: boolean }) =>
      dispatch({ type: "JIRA_CONFIGURED", connected });
    const onJiraContextLoaded = (data: { ticketId: string; description: string; comments: JiraComment[] }) =>
      dispatch({ type: "JIRA_CONTEXT_LOADED", ...data });
    const onPointsAssigned = (data: { ticketId: string; points: number }) =>
      dispatch({ type: "POINTS_ASSIGNED", ticketId: data.ticketId, points: data.points });
    const onError = (data: { message: string }) => dispatch({ type: "SET_ERROR", message: data.message });
    const onJiraError = (data: { ticketId?: string; message: string }) =>
      dispatch({ type: "SET_JIRA_ERROR", message: data.message });
    const join = () => {
      socket.emit("join-session", { sessionId, participantName, participantId, isSpectator });
    };

    socket.on("session-state", onSessionState);
    socket.on("disconnect", onDisconnect);
    socket.on("participant-joined", onParticipantJoined);
    socket.on("participant-left", onParticipantLeft);
    socket.on("vote-updated", onVoteUpdated);
    socket.on("votes-revealed", onVotesRevealed);
    socket.on("ticket-added", onTicketAdded);
    socket.on("tickets-added", onTicketsAdded);
    socket.on("ticket-removed", onTicketRemoved);
    socket.on("ticket-updated", onTicketUpdated);
    socket.on("voting-reset", onVotingReset);
    socket.on("comment-added", onCommentAdded);
    socket.on("active-ticket-changed", onActiveTicketChanged);
    socket.on("timer-started", onTimerStarted);
    socket.on("timer-stopped", onTimerStopped);
    socket.on("jira-configured", onJiraConfigured);
    socket.on("jira-context-loaded", onJiraContextLoaded);
    socket.on("points-assigned", onPointsAssigned);
    socket.on("error", onError);
    socket.on("jira-error", onJiraError);
    socket.on("connect", join);

    if (socket.connected) {
      join();
    } else {
      socket.connect();
    }

    return () => {
      socket.off("session-state", onSessionState);
      socket.off("disconnect", onDisconnect);
      socket.off("participant-joined", onParticipantJoined);
      socket.off("participant-left", onParticipantLeft);
      socket.off("vote-updated", onVoteUpdated);
      socket.off("votes-revealed", onVotesRevealed);
      socket.off("ticket-added", onTicketAdded);
      socket.off("tickets-added", onTicketsAdded);
      socket.off("ticket-removed", onTicketRemoved);
      socket.off("ticket-updated", onTicketUpdated);
      socket.off("voting-reset", onVotingReset);
      socket.off("comment-added", onCommentAdded);
      socket.off("active-ticket-changed", onActiveTicketChanged);
      socket.off("timer-started", onTimerStarted);
      socket.off("timer-stopped", onTimerStopped);
      socket.off("jira-configured", onJiraConfigured);
      socket.off("jira-context-loaded", onJiraContextLoaded);
      socket.off("points-assigned", onPointsAssigned);
      socket.off("error", onError);
      socket.off("jira-error", onJiraError);
      socket.off("connect", join);
    };
  }, [sessionId, participantName, participantId, isSpectator]);

  const setViewingTicketId = useCallback((ticketId: string) => {
    dispatch({ type: "SET_VIEWING_TICKET", ticketId });
  }, []);

  const emit = useCallback((event: string, payload?: unknown) => {
    getSocket().emit(event, payload);
  }, []);

  const isHost = state.session?.participants.find((p) => p.id === participantId)?.isHost ?? false;
  const currentTicket = state.session?.tickets.find((t) => t.id === state.viewingTicketId) ?? null;
  const amSpectator = state.session?.participants.find((p) => p.id === participantId)?.isSpectator ?? false;
  const isRevealed = currentTicket?.status === "revealed";
  const voteKey = currentTicket ? `${currentTicket.id}:${currentTicket.round}` : "";
  const myVote: VoteValue | undefined =
    isRevealed && currentTicket ? currentTicket.votes[participantId] : myLocalVotes[voteKey];

  const castVote = useCallback(
    (value: VoteValue) => {
      if (!currentTicket || currentTicket.status !== "voting" || amSpectator) return;
      if (myVote === value) {
        setMyLocalVotes(({ [voteKey]: _cleared, ...rest }) => rest);
        emit("clear-vote", { ticketId: currentTicket.id });
      } else {
        setMyLocalVotes((votes) => ({ ...votes, [voteKey]: value }));
        emit("submit-vote", { ticketId: currentTicket.id, points: value });
      }
    },
    [currentTicket, voteKey, myVote, amSpectator, emit]
  );

  return (
    <SessionContext.Provider
      value={{
        session: state.session,
        currentTicket,
        viewingTicketId: state.viewingTicketId,
        myParticipantId: participantId,
        isHost,
        timerEndsAt: state.timerEndsAt,
        error: state.error,
        jiraError: state.jiraError,
        isReconnecting,
        myVote,
        amSpectator,
        castVote,
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
