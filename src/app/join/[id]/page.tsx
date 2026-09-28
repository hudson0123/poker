"use client";

import { useState } from "react";
import { TalkiatryLogo } from "@/components/TalkiatryLogo";
import { useRouter, useParams } from "next/navigation";
import { getParticipantId } from "@/lib/socket";

export default function JoinPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;
  const [name, setName] = useState("");
  const [isSpectator, setIsSpectator] = useState(false);
  const [error, setError] = useState("");

  const handleJoin = () => {
    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }
    const participantId = getParticipantId();
    const queryParams = new URLSearchParams({
      name: name.trim(),
      participantId,
      spectator: isSpectator ? "1" : "0",
    });
    router.push(`/session/${sessionId}?${queryParams}`);
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <TalkiatryLogo className="mx-auto mb-5 h-8" />
          <h1 className="text-4xl font-bold text-secondary">
            S2V <span className="underline decoration-primary decoration-[6px] underline-offset-[6px]">Poker</span>
          </h1>
          <p className="mt-2 text-muted">Join the session</p>
        </div>

        <div className="rounded-2xl bg-surface p-6 shadow-md space-y-4">
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            autoFocus
            className="w-full rounded-lg border border-gray-200 px-4 py-3 text-secondary placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/60"
          />

          <label className="flex items-center gap-3 text-sm text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={isSpectator}
              onChange={(e) => setIsSpectator(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary-ink focus:ring-primary"
            />
            Join as spectator (observe only, no voting)
          </label>

          <button
            onClick={handleJoin}
            className="w-full rounded-lg bg-primary py-3 font-semibold text-secondary transition-colors hover:bg-primary-dark"
          >
            Join Session
          </button>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      </div>
    </main>
  );
}
