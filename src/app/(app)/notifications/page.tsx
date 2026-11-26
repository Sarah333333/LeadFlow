import Link from "next/link";
import { AlertCircle, Bell, Flame, Gauge, MessageCircle } from "lucide-react";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn, relative } from "@/lib/utils";
import { markAllRead } from "./actions";

export const metadata = { title: "Alerts" };

const ICONS: Record<string, { icon: React.ElementType; cls: string }> = {
  hot_lead: { icon: Flame, cls: "bg-hot-soft text-hot" },
  needs_attention: { icon: AlertCircle, cls: "bg-warm-soft text-warm" },
  lead_replied: { icon: MessageCircle, cls: "bg-canvas text-ink-2" },
  limit_reached: { icon: Gauge, cls: "bg-danger-soft text-danger" },
};

export default async function NotificationsPage() {
  await requireBusiness();
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
  const unread = (data ?? []).filter((n) => !n.read_at).length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Alerts" description="Hot leads and conversations that need you."
        actions={unread > 0 && <form action={markAllRead}><Button variant="secondary" size="sm">Mark all as read</Button></form>} />
      <Card>
        {!data?.length ? (
          <EmptyState icon={<Bell className="size-5" />} title="No alerts yet" description="You'll be alerted here — and by email/SMS — when a lead turns hot or needs a human." />
        ) : (
          <ul className="divide-y divide-line">
            {data.map((n) => {
              const { icon: Icon, cls } = ICONS[n.type] ?? ICONS.lead_replied;
              return (
                <li key={n.id}>
                  <Link href={n.lead_id ? `/leads/${n.lead_id}` : "/dashboard"} className={cn("flex gap-3 px-5 py-4 hover:bg-canvas/70", !n.read_at && "bg-brand-soft/30")}>
                    <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", cls)}><Icon className="size-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-medium">{n.title.replace(/^🔥\s*/, "")}{!n.read_at && <span className="size-1.5 rounded-full bg-brand" aria-label="Unread" />}</span>
                      <span className="mt-0.5 block text-[13px] text-muted">{n.body}</span>
                    </span>
                    <span className="shrink-0 text-xs text-faint">{relative(n.created_at)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
