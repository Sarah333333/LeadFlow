import { PageHeader } from "@/components/ui";
import { SettingsTabs } from "./tabs";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Settings" />
      <SettingsTabs />
      <div className="mt-6">{children}</div>
    </div>
  );
}
