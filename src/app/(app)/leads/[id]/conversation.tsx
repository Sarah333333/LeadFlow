"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, FlaskConical, Pencil, Send, Trash2, UserRound } from "lucide-react";
import type { Message } from "@/lib/types";
import { Button, Notice } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";
import { approveDraftAction, discardDraftAction, ownerSendAction, simulateLeadAction } from "../actions";

/** Provenance labels: who wrote each message. */
function origin(m: Message) {
  if (m.sender === "owner") return "Sent by you";
  if (m.sender === "ai") return m.approved_at ? (m.original_body ? "AI draft, edited & sent by you" : "AI-generated, approved by you") : "AI-generated";
  return "";
}

export function Conversation({ leadId, leadName, messages, isTest, aiPaused, optedOut }: {
  leadId: string; leadName: string; messages: Message[]; isTest: boolean; aiPaused: boolean; optedOut: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"owner" | "lead">(isTest && !aiPaused ? "lead" : "owner");
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [optimistic, setOptimistic] = useState<{ body: string; mode: "owner" | "lead" } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages.length, optimistic]);
  // Poll for new inbound SMS / follow-ups while the page is open.
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 8000);
    return () => clearInterval(t);
  }, [router]);
  useEffect(() => {
    const focus = () => { setMode("owner"); document.getElementById("composer")?.focus(); };
    window.addEventListener("leadflow:takeover", focus);
    return () => window.removeEventListener("leadflow:takeover", focus);
  }, []);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!body) return;
    setError(undefined);
    setOptimistic({ body, mode });
    setText("");
    start(async () => {
      try {
        const res = mode === "lead" ? await simulateLeadAction(leadId, body) : await ownerSendAction(leadId, body);
        if (res?.error) setError(res.error);
      } catch {
        setError("Something went wrong. Please refresh and try again.");
      }
      setOptimistic(null);
      router.refresh();
    });
  }

  const shown = messages.filter((m) => m.sender !== "system" && m.status !== "discarded");
  return (
    <div className="flex h-full min-h-[520px] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
        {shown.length === 0 && !optimistic && (
          <p className="py-16 text-center text-sm text-muted">No messages yet.</p>
        )}
        {shown.map((m, i) => {
          const showDay = i === 0 || formatDate(shown[i - 1].created_at, "yyyy-MM-dd") !== formatDate(m.created_at, "yyyy-MM-dd");
          return (
            <div key={m.id}>
              {showDay && <div suppressHydrationWarning className="mb-4 text-center text-[11px] font-medium uppercase tracking-wide text-faint">{formatDate(m.created_at, "EEE d MMM")}</div>}
              {m.status === "draft" ? <DraftBubble m={m} leadId={leadId} onDone={() => router.refresh()} /> : <Bubble m={m} leadName={leadName} />}
            </div>
          );
        })}
        {optimistic && (
          <Bubble m={{ id: "o", body: optimistic.body, direction: optimistic.mode === "lead" ? "inbound" : "outbound", sender: optimistic.mode === "lead" ? "lead" : "owner", created_at: new Date().toISOString(), status: "sending", is_follow_up: false, error: null } as unknown as Message} leadName={leadName} />
        )}
        {pending && optimistic?.mode === "lead" && !aiPaused && (
          <div className="flex items-center gap-2 text-xs text-muted"><Bot className="size-3.5" /> Assistant is typing<span className="animate-pulse">…</span></div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-line bg-surface p-3 sm:p-4">
        {isTest && (
          <div className="mb-2.5 flex items-center gap-1 text-xs">
            <FlaskConical className="mr-1 size-3.5 text-muted" />
            <span className="mr-2 text-muted">Test mode:</span>
            {(["lead", "owner"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={cn("rounded-md px-2 py-1 transition", mode === m ? "bg-ink text-white" : "text-ink-2 hover:bg-black/5")}>
                {m === "lead" ? `Reply as ${leadName.split(" ")[0]}` : "Reply as you"}
              </button>
            ))}
          </div>
        )}
        {error && <Notice tone="danger" className="mb-2">{error}</Notice>}
        {optedOut ? (
          <Notice>This lead opted out. You can&apos;t message them from LeadFlow.</Notice>
        ) : (
          <form onSubmit={submit} className="flex items-end gap-2">
            <textarea id="composer" value={text} onChange={(e) => setText(e.target.value)} rows={1}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              placeholder={mode === "lead" ? `Type what ${leadName.split(" ")[0]} would say…` : aiPaused ? "Write a message…" : "Write a message — sending will pause the assistant"}
              className="field max-h-40 min-h-[40px] resize-none" />
            <Button type="submit" variant={mode === "lead" ? "secondary" : "primary"} disabled={pending || !text.trim()} aria-label="Send">
              <Send className="size-4" />
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

function Bubble({ m, leadName }: { m: Message; leadName: string }) {
  const out = m.direction === "outbound";
  return (
    <div className={cn("flex flex-col", out ? "items-end" : "items-start")}>
      <div className={cn("max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed sm:max-w-[75%]",
        out ? (m.sender === "owner" ? "rounded-br-md bg-ink text-white" : "rounded-br-md bg-brand text-white")
          : "rounded-bl-md border border-line bg-surface text-ink")}>
        {m.body}
      </div>
      <div className="mt-1 flex items-center gap-1.5 px-1 text-[11px] text-faint">
        {out ? (m.sender === "owner" ? <UserRound className="size-3" /> : <Bot className="size-3" />) : null}
        <span>{out ? origin(m) : `${leadName.split(" ")[0]} (customer)`}</span>
        {m.is_follow_up && <span>· follow-up</span>}
        <span suppressHydrationWarning>· {formatDate(m.created_at, "HH:mm")}</span>
        {m.status === "failed" && <span className="text-danger" title={m.error ?? ""}>· not delivered</span>}
      </div>
    </div>
  );
}

function DraftBubble({ m, leadId, onDone }: { m: Message; leadId: string; onDone: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(m.body);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok?: boolean; error?: string }>) => start(async () => {
    try { const r = await fn(); setError(r?.error); } catch { setError("Something went wrong."); }
    onDone();
  });
  return (
    <div className="flex flex-col items-end">
      <div className="w-full max-w-[85%] rounded-2xl rounded-br-md border-2 border-dashed border-brand/40 bg-brand-soft/50 p-3 sm:max-w-[75%]">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-brand"><Bot className="size-3" /> AI draft — not sent</div>
        {editing
          ? <textarea className="field min-h-[80px]" value={text} onChange={(e) => setText(e.target.value)} aria-label="Edit draft" />
          : <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{m.body}</p>}
        {error && <Notice tone="danger" className="mt-2">{error}</Notice>}
        <div className="mt-2.5 flex flex-wrap justify-end gap-1.5">
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => discardDraftAction(leadId, m.id))}><Trash2 className="size-3.5" /> Discard</Button>
          {!editing && <Button size="sm" variant="secondary" disabled={pending} onClick={() => setEditing(true)}><Pencil className="size-3.5" /> Edit</Button>}
          <Button size="sm" variant="brand" disabled={pending || !text.trim()}
            onClick={() => run(() => approveDraftAction(leadId, m.id, editing && text !== m.body ? text : null))}>
            <Check className="size-3.5" /> {editing ? "Send edited" : "Approve & send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
