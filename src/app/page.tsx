"use client";

import { useState } from "react";
import { TalkiatryLogo } from "@/components/TalkiatryLogo";
import { useRouter } from "next/navigation";
import { getSocket, getParticipantId } from "@/lib/socket";

export default function Home() {
  const router = useRouter();
  const [sessionName, setSessionName] = useState("");
  const [hostName, setHostName] = useState("");
  const [joinLink, setJoinLink] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = () => {
    if (!sessionName.trim() || !hostName.trim()) {
      setError("Please fill in both fields");
      return;
    }
    setCreating(true);
    setError("");

    const socket = getSocket();
    socket.connect();

    socket.emit(
      "create-session",
      { name: sessionName.trim(), participantId: getParticipantId(), hostName: hostName.trim() },
      (response: { sessionId: string }) => {
        router.push(`/session/${response.sessionId}`);
      }
    );
  };

  const handleJoin = () => {
    const match = joinLink.match(/\/(?:join|session)\/([a-zA-Z0-9_-]+)/);
    const sessionId = match ? match[1] : joinLink.trim();
    if (!sessionId) {
      setError("Please enter a valid session link or ID");
      return;
    }
    router.push(`/join/${sessionId}`);
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <TalkiatryLogo className="mx-auto mb-5 h-8" />
          <h1 className="text-5xl font-bold text-secondary">
            Planning <span className="underline decoration-primary decoration-[6px] underline-offset-[6px]">Poker</span>
          </h1>
        </div>

        {/* Create Session */}
        <div className="rounded-2xl bg-surface p-6 shadow-md space-y-4">
          <h2 className="text-lg font-semibold text-secondary">Create a Session</h2>
          <input
            type="text"
            placeholder="Session name (e.g. Sprint 42)"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-4 py-3 text-secondary placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/60"
          />
          <input
            type="text"
            placeholder="Your name"
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-4 py-3 text-secondary placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/60"
          />
          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full rounded-lg bg-primary py-3 font-semibold text-secondary transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create Session"}
          </button>
        </div>

        {/* Join Session */}
        <div className="rounded-2xl bg-surface p-6 shadow-md space-y-4">
          <h2 className="text-lg font-semibold text-secondary">Join a Session</h2>
          <input
            type="text"
            placeholder="Paste session link or ID"
            value={joinLink}
            onChange={(e) => setJoinLink(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            className="w-full rounded-lg border border-gray-200 px-4 py-3 text-secondary placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/60"
          />
          <button
            onClick={handleJoin}
            className="w-full rounded-lg border-2 border-primary py-3 font-semibold text-primary-ink transition-colors hover:bg-primary hover:text-secondary"
          >
            Join Session
          </button>
        </div>

        {error && <p className="text-center text-sm text-red-500">{error}</p>}
      </div>
    </main>
  );
}
