"use client";

import { useSession } from "@/context/SessionContext";
import { Markdown } from "@/components/Markdown";

export function TicketHeader() {
  const { currentTicket } = useSession();

  if (!currentTicket) {
    return (
      <div className="rounded-xl bg-surface p-6 text-center shadow-sm">
        <p className="text-muted">Select a ticket from the sidebar to begin</p>
      </div>
    );
  }

  const displayTitle = currentTicket.title === currentTicket.jiraKey ? "" : currentTicket.title;

  return (
    <div className="rounded-xl bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-secondary">
            {currentTicket.jiraKey && (
              <span className="text-primary-ink">
                {currentTicket.jiraKey}{displayTitle ? ": " : ""}
              </span>
            )}
            {displayTitle}
          </h2>
          {currentTicket.jiraDescription && (
            <div className="mt-2 max-h-56 overflow-y-auto">
              <Markdown className="text-sm text-muted leading-relaxed">{currentTicket.jiraDescription}</Markdown>
            </div>
          )}
        </div>
        {currentTicket.jiraKey && (
          <a
            href={currentTicket.jiraUrl ?? `https://talkiatry.atlassian.net/browse/${currentTicket.jiraKey}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary-ink hover:bg-primary/20 transition-colors"
          >
            Open in Jira &rarr;
          </a>
        )}
      </div>
      {currentTicket.round > 1 && (
        <span className="mt-2 inline-block rounded bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
          Round {currentTicket.round}
        </span>
      )}
    </div>
  );
}
