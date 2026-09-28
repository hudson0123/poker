"use client";

import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useSession } from "@/context/SessionContext";
import { computeVoteStats } from "@/lib/vote-stats";
import { Confetti } from "./Confetti";
import { POINT_VALUES } from "@/lib/types";
import { getSocket } from "@/lib/socket";

export function RevealView() {
  const { currentTicket, session, isHost, emit } = useSession();
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // The assigned value itself lives on the ticket (see POINTS_ASSIGNED in
  // SessionContext); only the in-flight request state is local, and it
  // belongs to whichever ticket is on screen.
  useEffect(() => {
    setAssigning(false);
    setAssignError(null);

    const socket = getSocket();
    const onAssigned = ({ ticketId, points, fieldId }: { ticketId: string; points: number; fieldId?: string }) => {
      if (ticketId === currentTicket?.id) {
        console.log(`[jira] assigned ${points} pts via field "${fieldId}"`);
        setAssigning(false);
        setAssignError(null);
      }
    };
    const onError = ({ ticketId, message }: { ticketId?: string; message: string }) => {
      if (!ticketId || ticketId === currentTicket?.id) {
        setAssignError(message);
        setAssigning(false);
      }
    };
    socket.on("points-assigned", onAssigned);
    socket.on("jira-error", onError);
    return () => {
      socket.off("points-assigned", onAssigned);
      socket.off("jira-error", onError);
    };
  }, [currentTicket?.id]);

  const stats = useMemo(
    () => computeVoteStats(currentTicket?.votes ?? {}),
    [currentTicket]
  );

  if (!currentTicket || currentTicket.status !== "revealed") return null;

  const voters = session?.participants.filter((p) => !p.isSpectator) ?? [];
  const assignedPoints = currentTicket.assignedPoints ?? null;
  const showJiraAssign = isHost && session?.jiraConnected && currentTicket.jiraKey;

  const handleAssign = (points: number) => {
    setAssigning(true);
    setAssignError(null);
    emit("assign-points", { ticketId: currentTicket.id, points });
  };

  return (
    <div className="space-y-4">
      {stats.isConsensus && <Confetti seed={`${currentTicket.id}:${currentTicket.round}`} />}

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
                      : "border-primary bg-primary/5 text-primary-ink"
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

      {/* Jira point assignment */}
      {showJiraAssign && (
        <div className="rounded-xl bg-surface px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-xs font-semibold text-secondary">Assign to Jira</span>
            <span className="text-[10px] text-muted">{currentTicket.jiraKey}</span>
            <span className="ml-auto text-[10px] font-medium">
              {assigning && <span className="text-muted">Saving...</span>}
              {!assigning && assignedPoints !== null && <span className="text-success">✓ {assignedPoints} pts assigned</span>}
              {!assigning && assignError && <span className="text-red-500">{assignError}</span>}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {POINT_VALUES.map((pts) => (
              <button
                key={pts}
                onClick={() => handleAssign(pts)}
                disabled={assigning}
                title={`Assign ${pts} story points to ${currentTicket.jiraKey} in Jira`}
                className={`relative flex h-9 w-9 items-center justify-center rounded-lg border-2 text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:not-disabled:-translate-y-0.5 ${
                  assignedPoints === pts
                    ? "border-success bg-success/10 text-success"
                    : pts === stats.median
                      ? "border-primary bg-primary/5 text-primary-ink ring-2 ring-primary/20"
                      : "border-gray-200 text-secondary hover:border-primary/50 hover:text-primary-ink"
                }`}
              >
                {pts}
                {pts === stats.median && assignedPoints !== pts && (
                  <span className="absolute -top-1.5 -right-1.5 h-2 w-2 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
