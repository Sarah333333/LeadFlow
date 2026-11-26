import { redirect } from "next/navigation";
import { getBusiness, requireUser } from "@/lib/auth";
import { toProfile } from "@/lib/business/profile";
import { OnboardingWizard } from "./wizard";

export const metadata = { title: "Set up your business" };

export default async function OnboardingPage() {
  const user = await requireUser();
  const b = await getBusiness();
  if (b?.onboarding_completed) redirect("/dashboard");
  return <OnboardingWizard initial={toProfile(b, user.email ?? "")} />;
}
