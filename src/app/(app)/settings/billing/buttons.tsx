"use client";
import { useState, useTransition } from "react";
import { Button, Notice } from "@/components/ui";
import type { PlanId } from "@/lib/billing/plans";
import { openPortal, startCheckout } from "./actions";

export function CheckoutButton({ plan, label, highlighted }: { plan: PlanId; label: string; highlighted?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <>
      <Button className="w-full" variant={highlighted ? "primary" : "secondary"} disabled={pending}
        onClick={() => start(async () => { const r = await startCheckout(plan); if (r?.error) setError(r.error); })}>
        {pending ? "Redirecting…" : label}
      </Button>
      {error && <Notice tone="danger" className="mt-2">{error}</Notice>}
    </>
  );
}

export function PortalButton() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <>
      <Button variant="secondary" size="sm" disabled={pending} onClick={() => start(async () => { const r = await openPortal(); if (r?.error) setError(r.error); })}>
        {pending ? "Opening…" : "Manage billing & invoices"}
      </Button>
      {error && <Notice tone="danger" className="mt-2">{error}</Notice>}
    </>
  );
}
