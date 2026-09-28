"use client";

import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// react-markdown ignores raw HTML by default, so Jira content can't inject markup.
const components: Components = {
  h1: ({ children }) => <h3 className="mt-3 mb-1 text-base font-semibold text-secondary first:mt-0">{children}</h3>,
  h2: ({ children }) => <h4 className="mt-3 mb-1 text-sm font-semibold text-secondary first:mt-0">{children}</h4>,
  h3: ({ children }) => <h5 className="mt-2.5 mb-1 text-sm font-semibold text-secondary first:mt-0">{children}</h5>,
  h4: ({ children }) => <h6 className="mt-2 mb-1 text-sm font-medium text-secondary first:mt-0">{children}</h6>,
  h5: ({ children }) => <h6 className="mt-2 mb-1 text-sm font-medium text-secondary first:mt-0">{children}</h6>,
  h6: ({ children }) => <h6 className="mt-2 mb-1 text-sm font-medium text-secondary first:mt-0">{children}</h6>,
  p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary-ink underline hover:text-secondary">
      {children}
    </a>
  ),
  ul: ({ children, className }) => (
    <ul className={`my-1.5 space-y-0.5 pl-5 ${className?.includes("contains-task-list") ? "list-none pl-1" : "list-disc"}`}>
      {children}
    </ul>
  ),
  ol: ({ children, start }) => (
    <ol start={start} className="my-1.5 list-decimal space-y-0.5 pl-5">
      {children}
    </ol>
  ),
  input: ({ checked }) => <input type="checkbox" checked={checked} readOnly className="mr-1.5 align-middle" />,
  blockquote: ({ children }) => (
    <blockquote className="my-1.5 border-l-4 border-primary/20 bg-primary/5 py-1 pl-3 pr-2">{children}</blockquote>
  ),
  code: ({ children, className }) =>
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="rounded bg-background px-1 py-0.5 font-mono text-[0.85em] text-secondary">{children}</code>
    ),
  pre: ({ children }) => (
    <pre className="my-1.5 overflow-x-auto rounded-lg bg-background p-2.5 font-mono text-xs text-secondary">{children}</pre>
  ),
  hr: () => <hr className="my-3 border-gray-200" />,
  table: ({ children }) => (
    <div className="my-1.5 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-gray-200 bg-background px-2 py-1 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-gray-200 px-2 py-1 align-top">{children}</td>,
};

export function Markdown({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
