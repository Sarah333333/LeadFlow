import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { missingAgreements } from "@/lib/compliance/agreements";
import { AcceptForm } from "./form";

export const metadata = { title: "Updated terms" };

export default async function AcceptPage() {
  const user = await requireUser();
  const missing = await missingAgreements(user.id);
  if (!missing.length) redirect("/dashboard");
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <Logo />
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">Please review our updated terms</h1>
      <p className="mt-2 text-sm text-muted">
        We&apos;ve updated our <Link href="/terms" className="underline" target="_blank">Terms of Service</Link> and{" "}
        <Link href="/privacy" className="underline" target="_blank">Privacy Policy</Link>. Please read them before continuing.
      </p>
      <AcceptForm />
    </div>
  );
}
