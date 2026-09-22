"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "@/context/SessionContext";
import { Ticket } from "@/lib/types";
import { BulkImport } from "@/components/BulkImport";
import { JiraSetupModal } from "@/components/JiraSetupModal";

export function Sidebar() {
  const { session, viewingTicketId, isHost, setViewingTicketId, emit } = useSession();
  const [addingTicket, setAddingTicket] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newJiraUrl, setNewJiraUrl] = useState("");
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [jiraModalOpen, setJiraModalOpen] = useState(false);

  if (!session) return null;

  const handleAddTicket = () => {
    if (!newTitle.trim()) return;
    emit("add-ticket", { title: newTitle.trim(), jiraUrl: newJiraUrl.trim() || undefined });
    setNewTitle("");
    setNewJiraUrl("");
    setAddingTicket(false);
  };

  const handleRemoveTicket = (ticketId: string) => {
    emit("remove-ticket", { ticketId });
  };

  const statusColor = (ticket: Ticket) => {
    switch (ticket.status) {
      case "voting": return "bg-primary animate-pulse";
      case "revealed": return "bg-success";
      default: return "bg-muted/40";
    }
  };

  return (
    <aside className="flex h-full w-72 flex-col border-r border-gray-200 bg-surface">
      <div className="flex items-center justify-between border-b border-gray-200 p-4">
        <div>
          <h2 className="font-semibold text-secondary">{session.name}</h2>
          <p className="text-xs text-muted">
            {session.participants.filter((p) => p.isConnected).length} participant(s)
          </p>
        </div>
        {isHost && session.jiraConnected && (
          <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">Jira</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <AnimatePresence>
          {session.tickets.map((ticket, index) => (
            <motion.div
              key={ticket.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              role="button"
              tabIndex={0}
              onClick={() => setViewingTicketId(ticket.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setViewingTicketId(ticket.id);
                }
              }}
              className={`group mb-1 flex w-full cursor-pointer items-start gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                viewingTicketId === ticket.id
                  ? "bg-primary/10 text-primary"
                  : "text-secondary hover:bg-gray-50"
              }`}
            >
              <span className="flex items-center gap-2 min-w-0 flex-1">
                <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${statusColor(ticket)}`} />
                <span className="truncate">
                  <span className="text-muted mr-1">{index + 1}.</span>
                  {ticket.jiraKey && <span className="font-medium">{ticket.jiraKey}: </span>}
                  {ticket.title}
                </span>
              </span>
              {ticket.status === "revealed" && ticket.round > 1 && (
                <span className="flex-shrink-0 rounded bg-accent/10 px-1.5 py-0.5 text-xs text-accent">
                  R{ticket.round}
                </span>
              )}
              {session.activeTicketId === ticket.id && viewingTicketId !== ticket.id && (
                <span className="flex-shrink-0 text-xs text-primary font-medium">LIVE</span>
              )}
              {isHost && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveTicket(ticket.id); }}
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-muted hover:text-red-500 transition-opacity"
                  title="Remove ticket"
                >
                  &times;
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {session.tickets.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-muted">No tickets yet. {isHost ? "Add one below!" : "Waiting for host..."}</p>
        )}
      </div>

      {isHost && (
        <div className="border-t border-gray-200 p-3">
          {addingTicket ? (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Ticket title or JIRA-123"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTicket()}
                autoFocus
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-secondary placeholder:text-muted focus:border-primary focus:outline-none"
              />
              <input
                type="text"
                placeholder="Jira URL (optional)"
                value={newJiraUrl}
                onChange={(e) => setNewJiraUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTicket()}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-secondary placeholder:text-muted focus:border-primary focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddTicket}
                  className="flex-1 rounded-lg bg-primary py-1.5 text-sm font-medium text-white hover:bg-primary-dark"
                >
                  Add
                </button>
                <button
                  onClick={() => { setAddingTicket(false); setNewTitle(""); setNewJiraUrl(""); }}
                  className="flex-1 rounded-lg border border-gray-200 py-1.5 text-sm text-muted hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingTicket(true)}
              className="w-full rounded-lg border-2 border-dashed border-gray-200 py-2 text-sm text-muted transition-colors hover:border-primary hover:text-primary"
            >
              + Add Ticket
            </button>
          )}
          <button
            onClick={() => setBulkImportOpen(true)}
            className="w-full rounded-lg border border-gray-200 py-2 text-xs text-muted transition-colors hover:border-primary hover:text-primary mt-2"
          >
            Bulk Import
          </button>
          <button
            onClick={() => setJiraModalOpen(true)}
            className="w-full rounded-lg border border-gray-200 py-2 text-xs text-muted transition-colors hover:border-primary hover:text-primary mt-2"
          >
            {session.jiraConnected ? "⚡ Jira Connected" : "🔗 Connect Jira"}
          </button>
        </div>
      )}

      {/* Share link */}
      <div className="border-t border-gray-200 p-3">
        <button
          onClick={() => {
            const url = `${window.location.origin}/join/${session.id}`;
            navigator.clipboard.writeText(url);
          }}
          className="w-full rounded-lg bg-secondary/5 py-2 text-xs text-secondary transition-colors hover:bg-secondary/10"
        >
          Copy Invite Link
        </button>
      </div>

      <BulkImport open={bulkImportOpen} onClose={() => setBulkImportOpen(false)} />
      <JiraSetupModal open={jiraModalOpen} onClose={() => setJiraModalOpen(false)} />
    </aside>
  );
}
