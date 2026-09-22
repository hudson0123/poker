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

  return (
    <div className="flex flex-1 min-h-[16rem] flex-col rounded-xl bg-surface shadow-sm">
      <div className="border-b border-gray-200 p-4">
        <h3 className="font-semibold text-secondary">Comments</h3>
      </div>

      {/* Tabs */}
      {showJiraTab && (
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab("session")}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              activeTab === "session" ? "border-b-2 border-primary text-primary" : "text-muted hover:text-secondary"
            }`}
          >
            Session ({currentTicket?.comments.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab("jira")}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              activeTab === "jira" ? "border-b-2 border-primary text-primary" : "text-muted hover:text-secondary"
            }`}
          >
            Jira Context
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {tab === "session" && (
          <>
            {!currentTicket && <p className="text-sm text-muted">Select a ticket to see comments</p>}
            {currentTicket && currentTicket.comments.length === 0 && (
              <p className="text-sm text-muted">No comments yet</p>
            )}
            {currentTicket?.comments.map((c) => (
              <div key={c.id} className="rounded-lg bg-background p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-secondary">{c.participantName}</span>
                  <span className="text-[10px] text-muted">
                    {new Date(c.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="mt-1 text-sm text-secondary/80">{c.text}</p>
              </div>
            ))}
          </>
        )}

        {tab === "jira" && (
          <>
            {currentTicket?.jiraDescription && (
              <div className="rounded-lg bg-background p-3">
                <p className="text-xs font-medium text-muted mb-1">Description</p>
                <p className="text-sm text-secondary/80 whitespace-pre-wrap">{currentTicket.jiraDescription}</p>
              </div>
            )}
            {currentTicket?.jiraComments?.map((c, i) => (
              <div key={i} className="rounded-lg bg-background p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-secondary">{c.author}</span>
                  <span className="text-[10px] text-muted">
                    {c.created ? new Date(c.created).toLocaleDateString() : ""}
                  </span>
                </div>
                <p className="mt-1 text-sm text-secondary/80 whitespace-pre-wrap">{c.body}</p>
              </div>
            ))}
            {!hasJiraContext && <p className="text-sm text-muted">No Jira context available for this ticket</p>}
          </>
        )}
      </div>

      {/* Input — session tab only */}
      {tab === "session" && currentTicket && (
        <div className="border-t border-gray-200 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Add a comment..."
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-secondary placeholder:text-muted focus:border-primary focus:outline-none"
            />
            <button
              onClick={handleSubmit}
              disabled={!text.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-primary-dark transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
