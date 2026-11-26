import { Card, CardHeader, Notice } from "@/components/ui";
import { CopyBlock } from "@/components/copy-block";
import { RotateKeyButton } from "./rotate";
import { requireBusiness } from "@/lib/auth";
import { env, integrations } from "@/lib/env";

export const metadata = { title: "Lead sources" };

export default async function IntakeSettingsPage() {
  const { business: b } = await requireBusiness();
  const url = `${env.appUrl}/api/leads/intake/${b.intake_key}`;
  let site: URL | null = null;
  try { site = b.website ? new URL(/^https?:\/\//.test(b.website) ? b.website : `https://${b.website}`) : null; } catch { site = null; }
  const form = `<form action="${url}" method="POST">
  <input name="name" placeholder="Your name" required>
  <input name="phone" type="tel" placeholder="Mobile number" required>
  <input name="email" type="email" placeholder="Email">
  <input name="service" placeholder="What do you need?">
  <input name="location" placeholder="Town / area">
  <textarea name="message" placeholder="Tell us about the job"></textarea>
  <!-- SMS consent: must be unticked by default and ticked by the person. Without it, LeadFlow won't text them. -->
  <label><input type="checkbox" name="sms_consent" value="yes">
    I agree to be contacted by text message about my enquiry. Reply STOP to opt out at any time.</label>
  <input type="hidden" name="consent_text" value="I agree to be contacted by text message about my enquiry. Reply STOP to opt out at any time.">
  <!-- spam trap: keep hidden -->
  <input name="website" style="display:none" tabindex="-1" autocomplete="off">
${site ? `  <!-- where to send people after submitting (must be on ${site.hostname}) -->
  <input type="hidden" name="redirect" value="${site.origin}/thank-you">
` : ""}  <button type="submit">Get a quote</button>
</form>`;
  const json = `{
  "name": "John Murphy",
  "phone": "+353 87 123 4567",
  "email": "john@example.com",
  "service": "Roof repair",
  "location": "Dublin 15",
  "message": "Roof leaking in the back bedroom",
  "source": "facebook",
  "sms_consent": true,
  "consent_text": "Exact wording the person agreed to on your form"
}`;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Your lead webhook" description="Send leads from anywhere to this address. The assistant replies within seconds." />
        <div className="space-y-3 p-5">
          <CopyBlock value={url} />
          <p className="text-[13px] text-muted">Keep this URL private — anyone with it can add leads to your account. If it leaks, generate a new one.</p>
          <RotateKeyButton />
        </div>
      </Card>
      <Card>
        <CardHeader title="Website form" description="Paste this into your website (or point your existing form's action at the webhook)." />
        <div className="p-5"><CopyBlock value={form} multiline /></div>
      </Card>
      <Card>
        <CardHeader title="Facebook, Instagram, Google & others (via Zapier or Make)" />
        <div className="space-y-3 p-5 text-sm text-ink-2">
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Create a Zap with your lead source as the trigger (e.g. <em>Facebook Lead Ads → New Lead</em>).</li>
            <li>Add the action <em>Webhooks by Zapier → POST</em>, payload type <em>JSON</em>, URL = your webhook above.</li>
            <li>Map the fields below. Names are flexible — <code>first_name</code>/<code>last_name</code>, <code>phone_number</code>, <code>city</code>, <code>comments</code> all work.</li>
            <li><strong>Only send <code>sms_consent: true</code> if the person actually agreed to be texted</strong> (for example a consent question on your Facebook lead form) and include the wording they agreed to. Without it, LeadFlow saves the lead but won&apos;t text them.</li>
          </ol>
          <CopyBlock value={json} multiline />
        </div>
      </Card>
      <Card>
        <CardHeader title="Text messages (SMS)" />
        <div className="p-5 text-sm">
          {b.sms_number ? (
            <p>Your LeadFlow number is <span className="font-medium">{b.sms_number}</span>. Customers who text it become leads automatically, and the assistant replies from it.</p>
          ) : integrations.sms() ? (
            <Notice>SMS is enabled, using the shared number. Contact support to get a dedicated local number for your business.</Notice>
          ) : (
            <Notice tone="warn">SMS isn&apos;t connected yet. Until it is, new leads run in test mode — you can see and play out conversations in LeadFlow, but no texts are sent.</Notice>
          )}
        </div>
      </Card>
    </div>
  );
}
