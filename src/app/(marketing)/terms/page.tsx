import { LegalDoc } from "@/components/legal-doc";

export const dynamic = "force-static"; // the document is read at build time
export const metadata = { title: "Terms of Service (draft)" };

export default function Page() {
  return <LegalDoc file="TERMS_OF_SERVICE.md" />;
}
