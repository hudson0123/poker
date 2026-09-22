"use client";

import { useState } from "react";
import { useSession } from "@/context/SessionContext";

export function CommentsPanel() {
  const { currentTicket, emit, session } = useSession();
  const [text, setText] = useState("");
  const [activeTab, setActiveTab] = useState<"session" | "jira">("session");

  const handleSubmit = () => {
    if (!text.trim() || !currentTicket) return;
    emit("add-comment", { ticketId: currentTicket.id, text: text.trim() });
    setText("");
  };

  const hasJiraContext = currentTicket?.jiraDescription || (currentTicket?.jiraComments && currentTicket.jiraComments.length > 0);
  const showJiraTab = session?.jiraConnected && currentTicket?.jiraKey;
  const tab = showJiraTab ? activeTab : "session";

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
    <div className="flex flex-1 min-h-[12rem] flex-col rounded-xl bg-surface shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <h3 className="text-sm font-semibold text-secondary">Comments</h3>
        {showJiraTab && (
          <div className="flex gap-1 text-xs">
            <button
              onClick={() => setActiveTab("session")}
              className={`rounded px-2 py-0.5 font-medium transition-colors ${
                activeTab === "session" ? "bg-primary/10 text-primary" : "text-muted hover:text-secondary"
              }`}
            >
              Session ({currentTicket?.comments.length ?? 0})
            </button>
            <button
              onClick={() => setActiveTab("jira")}
              className={`rounded px-2 py-0.5 font-medium transition-colors ${
                activeTab === "jira" ? "bg-primary/10 text-primary" : "text-muted hover:text-secondary"
              }`}
            >
              Jira
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {tab === "session" && (
          <>
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
          </>
        )}

        {tab === "jira" && (
          <>
            {currentTicket?.jiraDescription && (
              <div className="rounded-lg bg-background px-2.5 py-1.5">
                <p className="text-[10px] font-medium text-muted">Description</p>
                <p className="text-xs text-secondary/80 whitespace-pre-wrap">{currentTicket.jiraDescription}</p>
              </div>
            )}
            {jiraComments.map((c, i) => (
              <div key={i} className="rounded-lg bg-background px-2.5 py-1.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-medium text-secondary">{c.author}</span>
                  <span className="text-[10px] text-muted">
                    {c.created ? new Date(c.created).toLocaleDateString() : ""}
                  </span>
                </div>
                <p className="text-xs text-secondary/80 whitespace-pre-wrap">{c.body}</p>
              </div>
            ))}
            {!hasJiraContext && <p className="text-xs text-muted">No Jira context available for this ticket</p>}
          </>
        )}
      </div>

      {/* Input — session tab only */}
      {tab === "session" && currentTicket && (
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
  );
}
