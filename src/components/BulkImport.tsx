"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "@/context/SessionContext";
import { parseBulkImport } from "@/lib/bulk-import";

interface BulkImportProps {
  open: boolean;
  onClose: () => void;
}

export function BulkImport({ open, onClose }: BulkImportProps) {
  const { emit } = useSession();
  const [text, setText] = useState("");

  const parsed = text.trim() ? parseBulkImport(text) : [];

  const handleImport = () => {
    if (parsed.length === 0) return;
    emit("add-tickets-bulk", { tickets: parsed });
    setText("");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-surface p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold text-secondary">Bulk Import Tickets</h2>
            <p className="mt-1 text-sm text-muted">
              One ticket per line. Use <code className="text-xs bg-gray-100 px-1 rounded">TA2-123 Title</code> to link to Jira automatically.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              autoFocus
              placeholder={"TA2-100 User login flow\nTA2-101 Dashboard redesign\nTA2-102 API rate limiting"}
              className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-secondary placeholder:text-muted focus:border-primary focus:outline-none resize-none"
            />
            {parsed.length > 0 && (
              <p className="mt-2 text-sm text-success">{parsed.length} ticket(s) detected</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-muted hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={parsed.length === 0}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-primary-dark"
              >
                Import {parsed.length > 0 ? `${parsed.length} Tickets` : ""}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
