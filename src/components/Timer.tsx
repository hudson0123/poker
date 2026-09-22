"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useSession } from "@/context/SessionContext";

export function Timer() {
  const { timerEndsAt, isHost, emit } = useSession();
  const [remaining, setRemaining] = useState(0);
  const [total, setTotal] = useState(0);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (!timerEndsAt) {
      setRemaining(0);
      return;
    }
    const endTime = new Date(timerEndsAt).getTime();
    const totalDuration = endTime - Date.now();
    setTotal(totalDuration > 0 ? totalDuration : 0);

    const interval = setInterval(() => {
      const left = Math.max(0, endTime - Date.now());
      setRemaining(left);
      if (left <= 0) clearInterval(interval);
    }, 100);
    return () => clearInterval(interval);
  }, [timerEndsAt]);

  const formatTime = (ms: number) => {
    const seconds = Math.ceil(ms / 1000);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const durations = [30, 60, 90, 120];

  if (!isHost && !timerEndsAt) return null;

  return (
    <div className="flex items-center gap-3">
      {timerEndsAt && remaining > 0 && (
        <div className="flex items-center gap-2 flex-1">
          <div className="h-2 flex-1 rounded-full bg-gray-100 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-accent"
              initial={{ width: "100%" }}
              animate={{ width: `${total > 0 ? (remaining / total) * 100 : 0}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
          <span className="text-sm font-mono font-medium text-accent w-12 text-right">{formatTime(remaining)}</span>
          {isHost && (
            <button onClick={() => emit("stop-timer")} className="text-xs text-muted hover:text-red-500">
              Stop
            </button>
          )}
        </div>
      )}

      {timerEndsAt && remaining <= 0 && (
        <span className="text-sm font-medium text-accent animate-pulse">Time&apos;s up!</span>
      )}

      {isHost && !timerEndsAt && (
        <div className="relative">
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-muted hover:border-primary hover:text-primary transition-colors"
          >
            ⏱ Timer
          </button>
          {showPicker && (
            <div className="absolute bottom-full mb-2 left-0 rounded-lg bg-surface border border-gray-200 shadow-lg p-2 flex gap-1 z-10">
              {durations.map((d) => (
                <button
                  key={d}
                  onClick={() => { emit("start-timer", { seconds: d }); setShowPicker(false); }}
                  className="rounded-md px-3 py-1.5 text-sm text-secondary hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  {d}s
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
