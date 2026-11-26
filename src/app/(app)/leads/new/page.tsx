import { Card, PageHeader } from "@/components/ui";
import { requireBusiness } from "@/lib/auth";
import { integrations } from "@/lib/env";
import type { ServiceItem } from "@/lib/types";
import { NewLeadForm } from "./form";

export const metadata = { title: "Add lead" };

export default async function NewLeadPage() {
  const { business } = await requireBusiness();
  const services = ((business.services as unknown as ServiceItem[]) ?? []).map((s) => s.name);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Add a lead" description="The assistant replies the moment you save." />
      <Card className="p-5 sm:p-7"><NewLeadForm smsEnabled={integrations.sms()} services={services} /></Card>
    </div>
  );
}
