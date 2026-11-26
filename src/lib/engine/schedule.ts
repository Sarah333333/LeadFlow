import type { Business } from "@/lib/types";

/** Move a time out of the business's quiet hours (e.g. 20:00–08:00 local). */
export function outsideQuietHours(date: Date, b: Pick<Business, "timezone" | "quiet_hours_start" | "quiet_hours_end">): Date {
  const d = new Date(date);
  const localHour = (x: Date) =>
    Number(new Intl.DateTimeFormat("en-GB", { timeZone: b.timezone, hour: "numeric", hourCycle: "h23" }).format(x));
  const quiet = (h: number) =>
    b.quiet_hours_start > b.quiet_hours_end
      ? h >= b.quiet_hours_start || h < b.quiet_hours_end
      : h >= b.quiet_hours_start && h < b.quiet_hours_end;
  for (let i = 0; i < 96 && quiet(localHour(d)); i++) d.setMinutes(d.getMinutes() + 15);
  return d;
}
