"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyBlock({ value, multiline }: { value: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className={`overflow-x-auto rounded-lg border border-line bg-canvas p-3 pr-12 font-mono text-[12.5px] leading-relaxed text-ink-2 ${multiline ? "max-h-72" : "whitespace-nowrap"}`}>{value}</pre>
      <button type="button" aria-label="Copy" onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="absolute right-2 top-2 grid size-7 place-items-center rounded-md border border-line bg-surface text-muted hover:text-ink">
        {copied ? <Check className="size-3.5 text-brand" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}
