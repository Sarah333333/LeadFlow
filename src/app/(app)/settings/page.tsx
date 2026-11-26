import { requireBusiness } from "@/lib/auth";
import { toProfile } from "@/lib/business/profile";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Business settings" };

export default async function BusinessSettingsPage() {
  const { business, user } = await requireBusiness();
  return <ProfileForm initial={toProfile(business, user.email ?? "")} />;
}
