// Every knob in one place. Missing optional keys degrade gracefully (demo payments, no texts).

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export const env = {
  appUrl: process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  sessionSecret: process.env.SESSION_SECRET || "dev-only-secret-change-me",
  adminPassword: process.env.ADMIN_PASSWORD || "",
  cronSecret: process.env.CRON_SECRET || "",

  // Stripe. When the secret key is missing, payments run in demo mode (no card, instant "paid").
  stripeSecret: process.env.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  stripePublishable: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
  get demoPayments(): boolean {
    return !this.stripeSecret || process.env.CHALK_DEMO_PAYMENTS === "1";
  },

  // Twilio for verification texts. Missing = verification disabled, unless OTP_DEV_CODE is set
  // AND payments are still in demo mode (the dev code stops working the moment real money is on).
  twilioSid: process.env.TWILIO_ACCOUNT_SID || "",
  twilioToken: process.env.TWILIO_AUTH_TOKEN || "",
  twilioFrom: process.env.TWILIO_FROM || "",
  get otpDevCode(): string {
    return this.demoPayments ? process.env.OTP_DEV_CODE || "" : "";
  },
  get smsEnabled(): boolean {
    return !!(this.twilioSid && this.twilioToken && this.twilioFrom);
  },
  get otpEnabled(): boolean {
    return this.smsEnabled || !!this.otpDevCode;
  },

  db: {
    url: process.env.DATABASE_URL || "",
    altUrl: process.env.DATABASE_URL_ALT || "",
  },
  req,
};

// Timing rules for matches, in minutes.
export const RULES = {
  OPEN_EXPIRES_MIN: 15, // paid, waiting for an opponent
  UNPAID_EXPIRES_MIN: 20, // tapped play, never paid
  PICK_WAIT_MIN: 15, // one player picked, other hasn't -> bartender
  LIVE_ABANDON_MIN: 120, // live, nobody picked anything
  DISPUTE_VOID_MIN: 120, // disputed, no bartender -> void + refund
  MIN_CASHOUT_CENTS: 100,
};
