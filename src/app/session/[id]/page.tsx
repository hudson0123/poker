"use client";

import { useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { SessionProvider, useSession } from "@/context/SessionContext";
import { Sidebar } from "@/components/Sidebar";
import { TicketHeader } from "@/components/TicketHeader";
import { VotingArea } from "@/components/VotingArea";
import { ParticipantList } from "@/components/ParticipantList";
import { RevealView } from "@/components/RevealView";
import { Timer } from "@/components/Timer";
import { CommentsPanel } from "@/components/CommentsPanel";
import { ExportSummary } from "@/components/ExportSummary";
import { POINT_VALUES } from "@/lib/types";

function SessionContent() {
  const { session, error, currentTicket, amSpectator, castVote, isReconnecting } = useSession();

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const digit = Number(e.key);
      if (!Number.isInteger(digit) || digit < 1 || digit > 9) return;
      if (!currentTicket || currentTicket.status !== "voting" || amSpectator) return;

      const closest = POINT_VALUES.reduce((best, value) =>
        Math.abs(value - digit) < Math.abs(best - digit) ? value : best
      );
      castVote(closest);
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentTicket, amSpectator, castVote]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-2xl bg-surface p-8 shadow-md text-center">
          <h2 className="text-xl font-semibold text-secondary">Oops!</h2>
          <p className="mt-2 text-muted">{error}</p>
          <a href="/" className="mt-4 inline-block text-primary-ink hover:underline">Back to Home</a>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-4 text-muted">Connecting to session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
        {isReconnecting && (
          <div className="rounded-lg bg-accent/10 px-4 py-2 text-center text-sm font-medium text-accent">
            Reconnecting...
          </div>
        )}
        <TicketHeader />
        <VotingArea />
        <RevealView />
        <div className="flex items-center justify-between">
          <Timer />
          <ExportSummary />
        </div>
        <ParticipantList />
        <CommentsPanel />
      </main>
    </div>
  );
}

export default function SessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = params.id as string;
  const name = searchParams.get("name") || "Anonymous";
  const isSpectator = searchParams.get("spectator") === "1";

  return (
    <SessionProvider sessionId={sessionId} participantName={name} isSpectator={isSpectator}>
      <SessionContent />
    </SessionProvider>
  );
}
