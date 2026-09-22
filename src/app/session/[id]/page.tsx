"use client";

import { useParams, useSearchParams } from "next/navigation";
import { SessionProvider, useSession } from "@/context/SessionContext";
import { Sidebar } from "@/components/Sidebar";
import { TicketHeader } from "@/components/TicketHeader";
import { VotingArea } from "@/components/VotingArea";
import { ParticipantList } from "@/components/ParticipantList";
import { RevealView } from "@/components/RevealView";

function SessionContent() {
  const { session, error } = useSession();

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-2xl bg-surface p-8 shadow-md text-center">
          <h2 className="text-xl font-semibold text-secondary">Oops!</h2>
          <p className="mt-2 text-muted">{error}</p>
          <a href="/" className="mt-4 inline-block text-primary hover:underline">Back to Home</a>
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
        <TicketHeader />
        <VotingArea />
        <RevealView />
        <ParticipantList />
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
