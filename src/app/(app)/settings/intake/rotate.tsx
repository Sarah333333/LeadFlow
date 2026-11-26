"use client";
import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button, Notice } from "@/components/ui";
import { rotateIntakeKeyAction } from "../actions";

export function RotateKeyButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok?: boolean; error?: string }>();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="secondary" size="sm" disabled={pending} onClick={() => {
        if (!confirm("Generate a new webhook URL? The current URL stops working immediately — update your website form and Zapier afterwards.")) return;
        start(async () => setResult(await rotateIntakeKeyAction()));
      }}>
        <RefreshCw className="size-3.5" /> {pending ? "Rotating…" : "Generate new URL"}
      </Button>
      {result?.ok && <span className="text-[13px] text-brand">New URL generated. The old one no longer works.</span>}
      {result?.error && <Notice tone="danger">{result.error}</Notice>}
    </div>
  );
}
