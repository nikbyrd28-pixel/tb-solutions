import { env } from "./env";

// Twilio over plain fetch (no SDK). Returns false when texting isn't configured.
export async function sendSms(to: string, text: string): Promise<boolean> {
  if (!env.smsEnabled) {
    console.log(`[sms disabled] to ${to}: ${text}`);
    return false;
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.twilioSid}/Messages.json`;
  const auth = Buffer.from(`${env.twilioSid}:${env.twilioToken}`).toString("base64");
  const form = new URLSearchParams({ To: to, From: env.twilioFrom, Body: text });
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!res.ok) {
    console.error("twilio error", res.status, await res.text());
    return false;
  }
  return true;
}
