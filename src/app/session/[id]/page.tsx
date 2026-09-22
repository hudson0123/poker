"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getSocket, getParticipantId } from "@/lib/socket";
import { SessionProvider } from "@/context/SessionContext";
import { Sidebar } from "@/components/Sidebar";
import { TicketHeader } from "@/components/TicketHeader";

function SessionContent() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
        <TicketHeader />
        <div className="rounded-xl bg-surface p-6 shadow-sm text-center text-muted">
          Voting area (coming next)
        </div>
      </main>
    </div>
  );
}

export default function SessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = params.id as string;
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const socket = getSocket();
    const participantId = getParticipantId();
    const name = searchParams.get("name");
    const isSpectator = searchParams.get("spectator") === "1";

    if (!socket.connected) {
      socket.connect();
    }

    socket.on("connect", () => {
      socket.emit("join-session", {
        sessionId,
        participantName: name || "Anonymous",
        participantId,
        isSpectator,
      });
    });

    socket.on("session-state", () => {
      setConnected(true);
    });

    socket.on("error", (data: { message: string }) => {
      setError(data.message);
    });

    if (socket.connected) {
      socket.emit("join-session", {
        sessionId,
        participantName: name || "Anonymous",
        participantId,
        isSpectator,
      });
    }

    return () => {
      socket.off("connect");
      socket.off("error");
    };
  }, [sessionId, searchParams]);

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

  if (!connected) {
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
    <SessionProvider>
      <SessionContent />
    </SessionProvider>
  );
}
