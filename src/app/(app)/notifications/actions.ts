"use server";
import { revalidatePath } from "next/cache";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { limit } from "@/lib/security/rate-limit";

export async function markAllRead() {
  const { user } = await requireBusiness();
  if (!(await limit("mutationPerUser", user.id))) return;
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  revalidatePath("/", "layout");
}
