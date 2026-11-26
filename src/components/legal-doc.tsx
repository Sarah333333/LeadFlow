import { readFileSync } from "node:fs";
import path from "node:path";
import Link from "next/link";
import { Fragment } from "react";

// Minimal, safe Markdown renderer for our own legal documents (headings, paragraphs, lists, bold, code, links).
// No HTML passthrough and no dangerouslySetInnerHTML: content is rendered as React text.
function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((p, i) => {
    if (p.startsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`")) return <code key={i} className="rounded bg-canvas px-1 text-[0.9em]">{p.slice(1, -1)}</code>;
    const m = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (m) {
      const href = m[2];
      if (/^\/(?!\/)/.test(href)) return <Link key={i} href={href} className="underline">{m[1]}</Link>;
      if (/^https:\/\//.test(href) || /^mailto:/.test(href)) return <a key={i} href={href} className="underline" rel="noreferrer noopener">{m[1]}</a>;
      return <Fragment key={i}>{m[1]}</Fragment>;
    }
    return <Fragment key={i}>{p}</Fragment>;
  });
}

export function LegalDoc({ file }: { file: string }) {
  const md = readFileSync(path.join(process.cwd(), "docs/legal", file), "utf8");
  const blocks = md.split(/\n{2,}/);
  return (
    <article className="mx-auto max-w-3xl px-5 py-14 text-[15px] leading-relaxed text-ink-2">
      {blocks.map((b, i) => {
        const t = b.trim();
        if (t.startsWith("# ")) return <h1 key={i} className="mb-6 text-3xl font-semibold tracking-tight text-ink">{inline(t.slice(2))}</h1>;
        if (t.startsWith("## ")) return <h2 key={i} className="mb-3 mt-10 text-xl font-semibold text-ink">{inline(t.slice(3))}</h2>;
        if (t.startsWith("### ")) return <h3 key={i} className="mb-2 mt-6 font-semibold text-ink">{inline(t.slice(4))}</h3>;
        if (t.startsWith("> ")) return <div key={i} className="my-6 rounded-lg border border-warm/30 bg-warm-soft px-4 py-3 text-sm text-[#7a5212]">{t.split("\n").map((l, j) => <p key={j}>{inline(l.replace(/^>\s?/, ""))}</p>)}</div>;
        if (/^[-*] /m.test(t) && t.split("\n").every((l) => /^\s*([-*]|\d+\.) /.test(l) || /^\s{2,}/.test(l))) {
          const ordered = /^\d+\. /.test(t);
          const items = t.split("\n").map((l) => l.replace(/^\s*([-*]|\d+\.) /, ""));
          const L = ordered ? "ol" : "ul";
          return <L key={i} className={`mb-4 space-y-1.5 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}>{items.map((it, j) => <li key={j}>{inline(it)}</li>)}</L>;
        }
        if (/^\d+\. /.test(t)) {
          return <ol key={i} className="mb-4 list-decimal space-y-1.5 pl-5">{t.split("\n").map((l, j) => <li key={j}>{inline(l.replace(/^\d+\. /, ""))}</li>)}</ol>;
        }
        return <p key={i} className="mb-4">{inline(t.replace(/\n/g, " "))}</p>;
      })}
    </article>
  );
}
