import "server-only";
// Central place for configuration. Optional integrations degrade gracefully when unset,
// so the app runs end-to-end locally with only Supabase configured.
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  openaiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
  openaiBaseUrl: process.env.OPENAI_BASE_URL || undefined,   // optional: proxy / Azure / test mock
  // The rule-based demo assistant must never talk to real customers in production unless explicitly allowed.
  allowDemoAi: process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_AI === "true",
  twilioSid: process.env.TWILIO_ACCOUNT_SID,
  twilioToken: process.env.TWILIO_AUTH_TOKEN,
  twilioDefaultNumber: process.env.TWILIO_PHONE_NUMBER,
  // Toll-fraud / SMS-pumping guard: only text numbers in these country codes.
  smsAllowedPrefixes: (process.env.SMS_ALLOWED_COUNTRY_CODES ?? "+353,+44,+1").split(",").map((s) => s.trim()).filter(Boolean),
  stripeSecret: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  stripePrices: {
    starter: process.env.STRIPE_PRICE_STARTER,
    growth: process.env.STRIPE_PRICE_GROWTH,
    pro: process.env.STRIPE_PRICE_PRO,
  },
  resendKey: process.env.RESEND_API_KEY,
  emailFrom: process.env.EMAIL_FROM ?? "LeadFlow AI <alerts@example.com>",
  cronSecret: process.env.CRON_SECRET,
};

export const integrations = {
  ai: () => Boolean(env.openaiKey),
  sms: () => Boolean(env.twilioSid && env.twilioToken),
  stripe: () => Boolean(env.stripeSecret),
  email: () => Boolean(env.resendKey),
};
