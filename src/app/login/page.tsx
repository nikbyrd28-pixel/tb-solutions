"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

function LoginInner() {
  const next = useSearchParams().get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const sb = supabaseBrowser();
  const redirect = `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback?next=${encodeURIComponent(next)}`;

  async function magic(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
    if (error) setErr(error.message); else setSent(true);
  }
  async function google() {
    await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirect } });
  }

  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-sm flex-col justify-center px-4 pb-24">
      <h1 className="font-display text-3xl font-800">Sign in</h1>
      <p className="mt-1 text-sm text-muted">No password. Just your email.</p>
      {sent ? (
        <p className="gborder mt-6 rounded-2xl bg-brand/10 p-4 text-sm">Check your email for the magic link.</p>
      ) : (
        <>
          <form onSubmit={magic} className="mt-6 flex flex-col gap-2">
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com"
              className="input rounded-full px-4 py-3" />
            <button className="btn btn-primary py-3">Send magic link</button>
          </form>
          <div className="my-4 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
          <button onClick={google} className="btn btn-ghost py-3">Continue with Google</button>
          {err && <p className="mt-3 text-sm text-brand-2">{err}</p>}
        </>
      )}
    </main>
  );
}

export default function Login() {
  return <Suspense><LoginInner /></Suspense>;
}
