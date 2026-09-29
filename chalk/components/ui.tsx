"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const money = (cents: number) => {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return abs % 100 === 0 ? `${sign}$${abs / 100}` : `${sign}$${(abs / 100).toFixed(2)}`;
};

export function Big({
  children,
  onClick,
  kind = "",
  disabled,
  busy,
  className = "",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void | Promise<void>;
  kind?: "" | "primary" | "win" | "warn" | "danger" | "ghost";
  disabled?: boolean;
  busy?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  const [inner, setInner] = useState(false);
  const run = async () => {
    if (inner || disabled || busy || !onClick) return;
    setInner(true);
    try {
      await onClick();
    } finally {
      setInner(false);
    }
  };
  const isBusy = busy || inner;
  return (
    <button type={type} className={`btn ${kind ? `btn-${kind}` : ""} ${className}`} onClick={type === "button" ? run : undefined} disabled={disabled || isBusy}>
      {isBusy ? <span className="spinner" /> : children}
    </button>
  );
}

export function Notice({ kind = "info", children }: { kind?: "bad" | "ok" | "info"; children: React.ReactNode }) {
  return <div className={`notice notice-${kind}`}>{children}</div>;
}

// Poll a JSON endpoint. Pauses when the tab is hidden. Returns data, error, and a manual refresh.
export function usePoll<T>(url: string | null, ms: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    if (!url) return;
    try {
      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json();
      if (!alive.current) return;
      if (!r.ok) setError(j.error || `Error ${r.status}`);
      else {
        setData(j as T);
        setError(null);
      }
    } catch {
      if (alive.current) setError("Can't reach the server. Check your signal.");
    }
  }, [url]);

  useEffect(() => {
    alive.current = true;
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState === "visible") await load();
      timer.current = setTimeout(tick, ms);
    };
    tick();
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load, ms]);

  return { data, error, refresh: load, setData };
}

export async function post<T = Record<string, unknown>>(url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
  return j as T;
}

export function PhoneInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const fmt = (raw: string) => {
    const d = raw.replace(/\D/g, "").slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  };
  return (
    <input
      className="input"
      inputMode="tel"
      autoComplete="tel"
      placeholder="(555) 555-5555"
      value={fmt(value)}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
      autoFocus={autoFocus}
    />
  );
}

export function Header({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="eyebrow">{sub}</div>
        <div className="h1">{title}</div>
      </div>
      {right}
    </div>
  );
}

export function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function fmtWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
