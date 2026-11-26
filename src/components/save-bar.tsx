"use client";
import { Button, Notice } from "@/components/ui";

export function SaveBar({ pending, result, label = "Save changes" }: { pending: boolean; result?: { ok?: boolean; error?: string }; label?: string }) {
  return (
    <div className="flex items-center justify-end gap-3">
      {result?.error && <Notice tone="danger" className="flex-1">{result.error}</Notice>}
      {result?.ok && !pending && <span className="text-[13px] text-brand">Saved</span>}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : label}</Button>
    </div>
  );
}
