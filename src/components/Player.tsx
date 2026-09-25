"use client";
import { useEffect, useRef } from "react";

function sessionId() {
  try {
    let s = localStorage.getItem("nb_sid");
    if (!s) { s = crypto.randomUUID(); localStorage.setItem("nb_sid", s); }
    return s;
  } catch { return "anon"; }
}

export default function Player({ src, poster, videoId }: { src: string; poster?: string; videoId: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const counted = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onTime = () => {
      if (!counted.current && el.currentTime > 3) {
        counted.current = true;
        fetch("/api/view", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ videoId, session: sessionId() }) });
      }
    };
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, [videoId]);

  return <video ref={ref} src={src} poster={poster} controls playsInline className="h-full w-full" />;
}
