"use client";

import { useState } from "react";
import { useSession } from "@/context/SessionContext";

export function CommentsPanel() {
  const { currentTicket, emit, session } = useSession();
  const [text, setText] = useState("");

  const showJira = session?.jiraConnected && currentTicket?.jiraKey;

  const handleSubmit = () => {
    if (!text.trim() || !currentTicket) return;
    emit("add-comment", { ticketId: currentTicket.id, text: text.trim() });
    setText("");
  };

  const sessionComments = currentTicket
    ? [...currentTicket.comments].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
    : [];

  const jiraComments = currentTicket?.jiraComments
    ? [...currentTicket.jiraComments].sort(
        (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
      )
    : [];

  return (
    <div className={`flex min-h-[14rem] gap-3 ${showJira ? "flex-row" : "flex-col"}`}>
      {/* Jira comments */}
      {showJira && (
        <div className="flex flex-1 flex-col rounded-xl bg-surface shadow-sm">
          <div className="border-b border-gray-200 px-3 py-2">
            <h3 className="text-sm font-semibold text-secondary">Jira Comments</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {currentTicket?.jiraComments === undefined && (
              <p className="text-xs text-muted">Loading...</p>
            )}
            {jiraComments.length > 0
              ? jiraComments.map((c, i) => (
                  <div key={i} className="rounded-lg bg-background px-2.5 py-1.5">
                    <div className="flex items-baseline gap-1.5 mb-0.5">
                      <span className="text-xs font-medium text-secondary">{c.author}</span>
                      <span className="text-[10px] text-muted">
                        {c.created ? new Date(c.created).toLocaleDateString() : ""}
                      </span>
                    </div>
                    <p className="text-xs text-secondary/80 whitespace-pre-wrap leading-relaxed">{c.body}</p>
                  </div>
                ))
              : currentTicket?.jiraComments !== undefined && (
                  <p className="text-xs text-muted">No Jira comments</p>
                )}
          </div>
        </div>
      )}

      {/* Session comments */}
      <div className="flex flex-1 flex-col rounded-xl bg-surface shadow-sm">
        <div className="border-b border-gray-200 px-3 py-2">
          <h3 className="text-sm font-semibold text-secondary">
            Session Comments{sessionComments.length > 0 ? ` (${sessionComments.length})` : ""}
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {!currentTicket && <p className="text-xs text-muted">Select a ticket to see comments</p>}
          {currentTicket && sessionComments.length === 0 && (
            <p className="text-xs text-muted">No comments yet</p>
          )}
          {sessionComments.map((c) => (
            <div key={c.id} className="rounded-lg bg-background px-2.5 py-1.5">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-medium text-secondary">{c.participantName}</span>
                <span className="text-[10px] text-muted">
                  {new Date(c.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="text-xs text-secondary/80">{c.text}</p>
            </div>
          ))}
        </div>
        {currentTicket && (
          <div className="border-t border-gray-200 p-2">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Add a comment..."
                className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-secondary placeholder:text-muted focus:border-primary focus:outline-none"
              />
              <button
                onClick={handleSubmit}
                disabled={!text.trim()}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 hover:bg-primary-dark transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
