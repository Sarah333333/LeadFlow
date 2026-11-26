"use client";
import { useActionState } from "react";
import { Button, Notice } from "@/components/ui";
import { acceptCurrentAgreements } from "./actions";

export function AcceptForm() {
  const [state, action, pending] = useActionState(acceptCurrentAgreements, undefined);
  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="accept" required className="mt-0.5 size-4 accent-[var(--color-brand)]" />
        I have read and agree to the updated Terms of Service and Privacy Policy.
      </label>
      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      <Button type="submit" disabled={pending}>Continue</Button>
    </form>
  );
}
