"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "@/context/SessionContext";
import { Ticket } from "@/lib/types";
import { BulkImport } from "@/components/BulkImport";
import { JiraSetupModal } from "@/components/JiraSetupModal";
import { TalkiatryLogo } from "@/components/TalkiatryLogo";

const SIDEBAR_MIN_WIDTH = 224;
const SIDEBAR_MAX_WIDTH = 560;
const SIDEBAR_DEFAULT_WIDTH = 288;
const SIDEBAR_WIDTH_KEY = "s2v-sidebar-width";

function clampWidth(width: number): number {
  return Math.min(Math.max(width, SIDEBAR_MIN_WIDTH), SIDEBAR_MAX_WIDTH);
}

function loadSavedWidth(): number {
  if (typeof window === "undefined") return SIDEBAR_DEFAULT_WIDTH;
  const saved = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
  return saved ? clampWidth(saved) : SIDEBAR_DEFAULT_WIDTH;
}

export function Sidebar() {
  const { session, viewingTicketId, isHost, setViewingTicketId, emit } = useSession();
  const [addingTicket, setAddingTicket] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [jiraModalOpen, setJiraModalOpen] = useState(false);
  const [width, setWidth] = useState(loadSavedWidth);
  const [resizing, setResizing] = useState(false);
  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
  }, [width]);

  if (!session) return null;

  const handleAddTicket = () => {
    if (!newTitle.trim()) return;
    emit("add-ticket", { title: newTitle.trim() });
    setNewTitle("");
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
    <aside
      ref={asideRef}
      style={{ width }}
      className="relative flex h-full flex-shrink-0 flex-col border-r border-gray-200 bg-surface"
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        aria-valuenow={width}
        aria-valuemin={SIDEBAR_MIN_WIDTH}
        aria-valuemax={SIDEBAR_MAX_WIDTH}
        tabIndex={0}
        title="Drag to resize, double-click to reset"
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          setResizing(true);
        }}
        onPointerMove={(e) => {
          if (!resizing || !asideRef.current) return;
          setWidth(clampWidth(e.clientX - asideRef.current.getBoundingClientRect().left));
        }}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId);
          setResizing(false);
        }}
        onDoubleClick={() => setWidth(SIDEBAR_DEFAULT_WIDTH)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setWidth((w) => clampWidth(w - 16));
          if (e.key === "ArrowRight") setWidth((w) => clampWidth(w + 16));
        }}
        className={`absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize transition-colors hover:bg-primary/30 focus:bg-primary/30 focus:outline-none ${
          resizing ? "bg-primary/40" : ""
        }`}
      />
      <div className="flex items-center justify-between border-b border-gray-200 p-4">
        <div>
          <TalkiatryLogo className="mb-2 h-4" />
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
              onClick={() => {
                setViewingTicketId(ticket.id);
                if (isHost) emit("set-active-ticket", { ticketId: ticket.id });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setViewingTicketId(ticket.id);
                  if (isHost) emit("set-active-ticket", { ticketId: ticket.id });
                }
              }}
              className={`group mb-1 flex w-full cursor-pointer items-start gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                viewingTicketId === ticket.id
                  ? "bg-primary/10 text-primary-ink"
                  : "text-secondary hover:bg-gray-50"
              }`}
            >
              <span className="flex items-center gap-2 min-w-0 flex-1">
                <span className={`h-2 w-2 flex-shrink-0 rounded-full ${statusColor(ticket)}`} />
                <span
                  className="truncate"
                  title={[ticket.jiraKey, ticket.title !== ticket.jiraKey && ticket.title].filter(Boolean).join(" ")}
                >
                  <span className="text-muted mr-1">{index + 1}.</span>
                  {ticket.jiraKey && <span className="mr-1 font-semibold">{ticket.jiraKey}</span>}
                  {ticket.title !== ticket.jiraKey && ticket.title}
                </span>
              </span>
              {ticket.status === "revealed" && ticket.round > 1 && (
                <span className="flex-shrink-0 rounded bg-accent/10 px-1.5 py-0.5 text-xs text-accent">
                  R{ticket.round}
                </span>
              )}
              {ticket.status === "waiting" && ticket.voterIds.length > 0 && (
                <span
                  className="flex-shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-muted"
                  title={`Voting paused with ${ticket.voterIds.length} vote(s) cast; resumes when the host returns`}
                >
                  PAUSED
                </span>
              )}
              {ticket.status === "voting" && (
                <span className="flex-shrink-0 text-[10px] font-semibold text-secondary bg-primary px-1.5 py-0.5 rounded">LIVE</span>
              )}
              {ticket.status !== "voting" && session.hostViewingTicketId === ticket.id && (
                <span className="flex-shrink-0 text-[10px] font-semibold text-primary-ink bg-primary/10 px-1.5 py-0.5 rounded">HOST</span>
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
                placeholder="TA2-1234 or ticket title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTicket()}
                autoFocus
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-secondary placeholder:text-muted focus:border-primary focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddTicket}
                  className="flex-1 rounded-lg bg-primary py-1.5 text-sm font-medium text-secondary hover:bg-primary-dark"
                >
                  Add
                </button>
                <button
                  onClick={() => { setAddingTicket(false); setNewTitle(""); }}
                  className="flex-1 rounded-lg border border-gray-200 py-1.5 text-sm text-muted hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingTicket(true)}
              className="w-full rounded-lg border-2 border-dashed border-gray-200 py-2 text-sm text-muted transition-colors hover:border-primary hover:text-primary-ink"
            >
              + Add Ticket
            </button>
          )}
          <button
            onClick={() => setBulkImportOpen(true)}
            className="w-full rounded-lg border border-gray-200 py-2 text-xs text-muted transition-colors hover:border-primary hover:text-primary-ink mt-2"
          >
            Bulk Import
          </button>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setJiraModalOpen(true)}
              className="flex-1 rounded-lg border border-gray-200 py-2 text-xs text-muted transition-colors hover:border-primary hover:text-primary-ink"
            >
              {session.jiraConnected ? "⚡ Jira Connected" : "🔗 Connect Jira"}
            </button>
            {session.jiraConnected && (
              <button
                onClick={() => emit("sync-refine-tickets")}
                title="Sync tickets labeled 'refine' from Jira backlog"
                className="rounded-lg border border-gray-200 px-2.5 py-2 text-xs text-muted transition-colors hover:border-primary hover:text-primary-ink"
              >
                ↻
              </button>
            )}
          </div>
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
