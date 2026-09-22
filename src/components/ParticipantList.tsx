"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "@/context/SessionContext";

export function ParticipantList() {
  const { session, currentTicket } = useSession();

  if (!session) return null;

  const voters = session.participants.filter((p) => !p.isSpectator && p.isConnected);
  const spectators = session.participants.filter((p) => p.isSpectator && p.isConnected);

  const hasVoted = (participantId: string): boolean | null => {
    if (!currentTicket || currentTicket.status === "waiting") return null;
    return participantId in currentTicket.votes;
  };

  const revealedVote = (participantId: string): string | null => {
    if (!currentTicket || currentTicket.status !== "revealed") return null;
    const vote = currentTicket.votes[participantId];
    return vote !== undefined ? String(vote) : null;
  };

  return (
    <div className="rounded-xl bg-surface p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-muted uppercase tracking-wide">Participants</h3>
      {voters.length === 0 ? (
        <p className="text-sm text-muted">No participants yet</p>
      ) : (
      <div className="flex flex-wrap gap-3">
        <AnimatePresence>
          {voters.map((p) => {
            const voted = hasVoted(p.id);
            const vote = revealedVote(p.id);
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2"
              >
                {currentTicket?.status === "revealed" && vote !== null ? (
                  <motion.span
                    initial={{ rotateY: 180 }}
                    animate={{ rotateY: 0 }}
                    transition={{ duration: 0.4 }}
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary"
                  >
                    {vote}
                  </motion.span>
                ) : (
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm ${
                      voted === true
                        ? "bg-success/10 text-success"
                        : voted === false
                          ? "bg-gray-100 text-muted"
                          : "bg-gray-50 text-muted"
                    }`}
                  >
                    {voted === true ? "✓" : voted === false ? "⏳" : "—"}
                  </span>
                )}
                <span className="text-sm text-secondary">
                  {p.name}
                  {p.isHost && <span className="ml-1 text-xs text-primary">(host)</span>}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      )}

      {spectators.length > 0 && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="text-xs text-muted">
            Spectators: {spectators.map((s) => s.name).join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}
