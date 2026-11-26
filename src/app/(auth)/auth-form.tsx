"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Button, Field, Notice } from "@/components/ui";
import { logIn, signUp } from "./actions";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [state, action, pending] = useActionState(mode === "login" ? logIn : signUp, undefined);
  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="Work email">
        <input name="email" type="email" required autoComplete="email" className="field" placeholder="you@company.com" />
      </Field>
      <Field label="Password" hint={mode === "signup" ? "At least 10 characters" : undefined}>
        <input name="password" type="password" required minLength={mode === "signup" ? 10 : undefined}
          autoComplete={mode === "login" ? "current-password" : "new-password"} className="field" />
      </Field>
      {mode === "signup" && (
        <label className="flex items-start gap-2.5 text-[13px] text-ink-2">
          <input type="checkbox" name="accept_terms" required className="mt-0.5 size-4 accent-[var(--color-brand)]" />
          <span>I agree to the <Link href="/terms" target="_blank" className="underline">Terms of Service</Link> and{" "}
            <Link href="/privacy" target="_blank" className="underline">Privacy Policy</Link>, and I&apos;m 18 or over and using LeadFlow for a business.</span>
        </label>
      )}
      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      {state?.message && <Notice tone="success">{state.message}</Notice>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
      </Button>
      <p className="text-center text-sm text-muted">
        {mode === "login" ? <>New to LeadFlow? <Link href="/signup" className="font-medium text-ink underline-offset-4 hover:underline">Start free trial</Link></>
          : <>Already have an account? <Link href="/login" className="font-medium text-ink underline-offset-4 hover:underline">Log in</Link></>}
      </p>
    </form>
  );
}
