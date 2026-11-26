import { LegalDoc } from "@/components/legal-doc";

export const dynamic = "force-static"; // the document is read at build time
export const metadata = { title: "Privacy Policy (draft)" };

export default function Page() {
  return <LegalDoc file="PRIVACY_POLICY.md" />;
}
