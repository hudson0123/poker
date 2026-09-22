"use client";

import { motion } from "framer-motion";
import { useSession } from "@/context/SessionContext";
import { Confetti } from "./Confetti";

export function RevealView() {
  const { currentTicket, session, revealedStats } = useSession();

  if (!currentTicket || currentTicket.status !== "revealed") return null;

  const stats = revealedStats[currentTicket.id];
  if (!stats) return null;

  const voters = session?.participants.filter((p) => !p.isSpectator) ?? [];

  return (
    <div className="space-y-4">
      {stats.isConsensus && <Confetti />}

      {stats.isConsensus && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="rounded-xl bg-success/10 p-4 text-center"
        >
          <p className="text-2xl font-bold text-success">Consensus! {stats.median}</p>
        </motion.div>
      )}

      {/* Vote cards flipped */}
      <div className="rounded-xl bg-surface p-6 shadow-sm">
        <div className="flex flex-wrap justify-center gap-4">
          {voters.map((participant, index) => {
            const vote = currentTicket.votes[participant.id];
            const isOutlier = stats.outlierParticipantIds.includes(participant.id);
            if (vote === undefined) return null;

            return (
              <motion.div
                key={participant.id}
                initial={{ rotateY: 180, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                transition={{ delay: index * 0.05, duration: 0.4 }}
                className="flex flex-col items-center gap-1"
              >
                <div
                  className={`flex h-24 w-16 items-center justify-center rounded-xl border-2 text-xl font-bold ${
                    isOutlier
                      ? "border-accent bg-accent/5 text-accent"
                      : "border-primary bg-primary/5 text-primary"
                  }`}
                >
                  {String(vote)}
                </div>
                <span className="text-xs text-muted max-w-[4rem] truncate">{participant.name}</span>
                {isOutlier && <span className="text-[10px] text-accent font-medium">outlier</span>}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Statistics */}
      <div className="rounded-xl bg-surface p-4 shadow-sm">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-primary">{stats.average.toFixed(1)}</p>
            <p className="text-xs text-muted">Average</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">{stats.median}</p>
            <p className="text-xs text-muted">Median</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-secondary">{stats.low}</p>
            <p className="text-xs text-muted">Low</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-secondary">{stats.high}</p>
            <p className="text-xs text-muted">High</p>
          </div>
        </div>
      </div>
    </div>
  );
}
