"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/context/SessionContext";
import { PointCard } from "./PointCard";
import { ALL_VOTE_VALUES, VoteValue } from "@/lib/types";

export function VotingArea() {
  const { currentTicket, myParticipantId, isHost, emit, session } = useSession();

  // The server never sends real vote values back to clients until a ticket is
  // revealed (see SessionStore.serializeSession) — so the local voter is the
  // only source of truth for their own selection while voting is in progress.
  const [myLocalVote, setMyLocalVote] = useState<VoteValue | undefined>(undefined);

  useEffect(() => {
    setMyLocalVote(undefined);
  }, [currentTicket?.id, currentTicket?.round]);

  if (!currentTicket) return null;

  const isVoting = currentTicket.status === "voting";
  const isRevealed = currentTicket.status === "revealed";
  const isWaiting = currentTicket.status === "waiting";
  const myVote: VoteValue | undefined = isRevealed ? currentTicket.votes[myParticipantId] : myLocalVote;
  const amSpectator = session?.participants.find((p) => p.id === myParticipantId)?.isSpectator ?? false;

  const handleVote = (value: VoteValue) => {
    if (!isVoting || amSpectator) return;
    if (myVote === value) {
      setMyLocalVote(undefined);
      emit("clear-vote", { ticketId: currentTicket.id });
    } else {
      setMyLocalVote(value);
      emit("submit-vote", { ticketId: currentTicket.id, points: value });
    }
  };

  const handleStartVoting = () => {
    emit("start-voting", { ticketId: currentTicket.id });
  };

  const handleReveal = () => {
    emit("reveal-votes", { ticketId: currentTicket.id });
  };

  const handleResetVoting = () => {
    emit("reset-voting", { ticketId: currentTicket.id });
  };

  const handleNextTicket = () => {
    if (!session) return;
    const currentIndex = session.tickets.findIndex((t) => t.id === currentTicket.id);
    const nextTicket = session.tickets[currentIndex + 1];
    if (nextTicket) {
      emit("start-voting", { ticketId: nextTicket.id });
    }
  };

  const hasNextTicket = session ? session.tickets.findIndex((t) => t.id === currentTicket.id) < session.tickets.length - 1 : false;

  return (
    <div className="space-y-4">
      {/* Voting cards */}
      {(isVoting || isWaiting) && !amSpectator && (
        <div className="rounded-xl bg-surface p-6 shadow-sm">
          <div className="flex flex-wrap justify-center gap-3">
            {ALL_VOTE_VALUES.map((value) => (
              <PointCard
                key={String(value)}
                value={value}
                selected={myVote === value}
                disabled={!isVoting}
                onClick={() => handleVote(value)}
              />
            ))}
          </div>
          {isWaiting && (
            <p className="mt-4 text-center text-sm text-muted">
              {isHost ? "Start voting when ready" : "Waiting for host to start voting..."}
            </p>
          )}
        </div>
      )}

      {/* Host controls */}
      {isHost && (
        <div className="flex justify-center gap-3">
          {isWaiting && (
            <button
              onClick={handleStartVoting}
              className="rounded-lg bg-primary px-6 py-2.5 font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              Start Voting
            </button>
          )}
          {isVoting && (
            <button
              onClick={handleReveal}
              className="rounded-lg bg-accent px-6 py-2.5 font-semibold text-white transition-colors hover:bg-accent-light"
            >
              End Voting &amp; Reveal
            </button>
          )}
          {isRevealed && (
            <>
              <button
                onClick={handleResetVoting}
                className="rounded-lg border-2 border-primary px-6 py-2.5 font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
              >
                Re-vote
              </button>
              {hasNextTicket && (
                <button
                  onClick={handleNextTicket}
                  className="rounded-lg bg-primary px-6 py-2.5 font-semibold text-white transition-colors hover:bg-primary-dark"
                >
                  Next Ticket &rarr;
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
