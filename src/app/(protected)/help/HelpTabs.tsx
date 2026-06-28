"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

interface Doc {
  id: string;
  label: string;
  content: string;
}

export default function HelpTabs({ docs }: { docs: Doc[] }) {
  const [active, setActive] = useState(docs[0]?.id ?? "");
  const current = docs.find((d) => d.id === active);

  return (
    <div>
      <div role="tablist" className="tabs tabs-lifted tabs-lg mb-6">
        {docs.map((doc) => (
          <button
            key={doc.id}
            role="tab"
            className={`tab text-base${active === doc.id ? " tab-active" : ""}`}
            onClick={() => setActive(doc.id)}
          >
            {doc.label}
          </button>
        ))}
      </div>

      <div className="prose prose-sm max-w-none
        prose-headings:text-base-content
        prose-p:text-base-content
        prose-li:text-base-content
        prose-strong:text-base-content
        prose-table:text-base-content
        prose-th:bg-base-200 prose-th:text-base-content
        prose-td:border-base-300
        prose-code:bg-base-200 prose-code:text-base-content prose-code:px-1 prose-code:rounded
        prose-pre:bg-base-200 prose-pre:text-base-content
        prose-blockquote:border-primary prose-blockquote:text-base-content/70
        prose-a:text-primary">
        {current && <ReactMarkdown>{current.content}</ReactMarkdown>}
      </div>
    </div>
  );
}
