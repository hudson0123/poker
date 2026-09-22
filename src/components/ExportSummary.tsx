"use client";

import { useState } from "react";
import { useSession } from "@/context/SessionContext";
import { generateExportMarkdown } from "@/lib/export-summary";

export function ExportSummary() {
  const { session, isHost } = useSession();
  const [copied, setCopied] = useState(false);

  if (!isHost || !session) return null;

  const handleExport = () => {
    const md = generateExportMarkdown(session);
    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleExport}
      className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-muted hover:border-primary hover:text-primary transition-colors"
    >
      {copied ? "Copied!" : "Export Summary"}
    </button>
  );
}
