"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { missingAgreements, recordAgreements } from "@/lib/compliance/agreements";
import { limit } from "@/lib/security/rate-limit";

export async function acceptCurrentAgreements(_: unknown, form: FormData) {
  const user = await requireUser();
  if (!(await limit("mutationPerUser", user.id))) return { error: "Too many requests — please wait a moment." };
  if (form.get("accept") !== "on") return { error: "Please tick the box to continue." };
  const missing = await missingAgreements(user.id);
  if (missing.length) await recordAgreements(user.id, null, missing);
  redirect("/dashboard");
}
