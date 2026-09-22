"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "@/context/SessionContext";

interface JiraSetupModalProps {
  open: boolean;
  onClose: () => void;
}

export function JiraSetupModal({ open, onClose }: JiraSetupModalProps) {
  const { emit, session, jiraError } = useSession();
  const [email, setEmail] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (jiraError) setLoading(false);
  }, [jiraError]);

  const handleSubmit = () => {
    if (!email.trim() || !apiToken.trim()) return;
    setLoading(true);
    emit("configure-jira", { baseUrl: "talkiatry.atlassian.net", email: email.trim(), apiToken: apiToken.trim() });
    setTimeout(() => setLoading(false), 3000);
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
            className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl space-y-4"
          >
            <h2 className="text-lg font-semibold text-secondary">Connect Jira</h2>

            {session?.jiraConnected ? (
              <div className="rounded-lg bg-success/10 p-3 text-sm text-success font-medium">
                Connected to Jira
              </div>
            ) : (
              <>
                <p className="text-sm text-muted">
                  Enter your Atlassian credentials to fetch ticket descriptions and comments from{" "}
                  <span className="font-medium text-secondary">talkiatry.atlassian.net</span>.{" "}
                  <a
                    href="https://id.atlassian.com/manage-profile/security/api-tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Generate an API token
                  </a>
                </p>

                <input
                  type="email"
                  placeholder="Your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-secondary placeholder:text-muted focus:border-primary focus:outline-none"
                />
                <input
                  type="password"
                  placeholder="API token"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-secondary placeholder:text-muted focus:border-primary focus:outline-none"
                />
                {jiraError && (
                  <p className="text-sm text-red-500" role="alert">
                    {jiraError}
                  </p>
                )}
              </>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-muted hover:bg-gray-50">
                {session?.jiraConnected ? "Close" : "Cancel"}
              </button>
              {!session?.jiraConnected && (
                <button
                  onClick={handleSubmit}
                  disabled={loading || !email.trim() || !apiToken.trim()}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-primary-dark"
                >
                  {loading ? "Connecting..." : "Connect"}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
