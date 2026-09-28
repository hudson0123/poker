"use client";

import { useSession } from "@/context/SessionContext";
import { PointCard } from "./PointCard";
import { ALL_VOTE_VALUES } from "@/lib/types";

export function VotingArea() {
  const { currentTicket, isHost, emit, session, myVote, amSpectator, castVote } = useSession();

  if (!currentTicket) return null;

  // Only the host's ticket is ever open for voting; any other ticket a
  // participant browses to is read-only.
  const isVoting = currentTicket.status === "voting";
  const isRevealed = currentTicket.status === "revealed";

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
      emit("set-active-ticket", { ticketId: nextTicket.id });
    }
  };

  const hasNextTicket = session ? session.tickets.findIndex((t) => t.id === currentTicket.id) < session.tickets.length - 1 : false;

  return (
    <div className="space-y-4">
      {/* Voting cards */}
      {isVoting && !amSpectator && (
        <div className="rounded-xl bg-surface px-4 py-3 shadow-sm">
          <div className="flex flex-wrap justify-center gap-2">
            {ALL_VOTE_VALUES.map((value) => (
              <PointCard
                key={String(value)}
                value={value}
                selected={myVote === value}
                disabled={false}
                onClick={() => castVote(value)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Host controls */}
      {isHost && (
        <div className="flex justify-center gap-3">
          {isVoting && (
            <button
              onClick={handleReveal}
              className="rounded-lg bg-secondary px-6 py-2.5 font-semibold text-white transition-colors hover:bg-secondary-light"
            >
              End Voting Now
            </button>
          )}
          {isRevealed && (
            <>
              <button
                onClick={handleResetVoting}
                className="rounded-lg border-2 border-primary px-6 py-2.5 font-semibold text-primary-ink transition-colors hover:bg-primary hover:text-secondary"
              >
                Re-vote
              </button>
              {hasNextTicket && (
                <button
                  onClick={handleNextTicket}
                  className="rounded-lg bg-primary px-6 py-2.5 font-semibold text-secondary transition-colors hover:bg-primary-dark"
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
