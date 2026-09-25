"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function Upload() {
  const router = useRouter();
  const sb = supabaseBrowser();
  const [f, setF] = useState({ title: "", description: "", kind: "long", visibility: "public", min_tier: "free", tags: "" });
  const [video, setVideo] = useState<File | null>(null);
  const [thumb, setThumb] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [pct, setPct] = useState(0);

  async function up(bucket: string, file: File) {
    const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]+/g, "-")}`;
    const { error } = await sb.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  async function duration(file: File): Promise<number | null> {
    return new Promise((res) => {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); res(Math.round(v.duration)); };
      v.onerror = () => res(null);
      v.src = URL.createObjectURL(file);
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!video) return;
    try {
      setStatus("Uploading video…"); setPct(20);
      const [video_url, duration_seconds] = await Promise.all([up("videos", video), duration(video)]);
      setPct(70);
      let thumbnail_url: string | null = null;
      if (thumb) { setStatus("Uploading thumbnail…"); thumbnail_url = await up("thumbnails", thumb); }
      setPct(90); setStatus("Saving…");
      const r = await fetch("/api/admin/video", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...f, video_url, thumbnail_url, duration_seconds }) });
      if (!r.ok) throw new Error((await r.json()).error);
      const row = await r.json();
      setPct(100); setStatus("Live!");
      router.push(row.kind === "short" ? "/feed" : `/watch/${row.slug}`);
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    }
  }

  const input = "w-full rounded-xl border border-line bg-bg-2 px-3 py-2.5 outline-none focus:border-brand";

  return (
    <main className="mx-auto max-w-xl px-4 pb-24 pt-8">
      <h1 className="flex items-center gap-2 text-2xl font-black"><UploadCloud className="text-brand" /> Upload</h1>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line p-8 text-center hover:border-brand">
          <input type="file" accept="video/*" hidden onChange={(e) => setVideo(e.target.files?.[0] ?? null)} />
          <UploadCloud size={28} className="text-muted" />
          <span className="text-sm">{video ? video.name : "Drop the video here (mp4 / webm / mov)"}</span>
        </label>
        <input required placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={input} />
        <textarea placeholder="Description" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className={input} />
        <div className="grid grid-cols-3 gap-3">
          <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className={input}>
            <option value="long">Long (YouTube-style)</option>
            <option value="short">Short (Chaos Feed)</option>
          </select>
          <select value={f.visibility} onChange={(e) => setF({ ...f, visibility: e.target.value })} className={input}>
            <option value="public">Public</option><option value="members">Members</option><option value="unlisted">Unlisted</option><option value="draft">Draft</option>
          </select>
          <select value={f.min_tier} onChange={(e) => setF({ ...f, min_tier: e.target.value })} className={input}>
            <option value="free">Free</option><option value="inner_circle">Inner Circle</option><option value="day_one">Day One</option>
          </select>
        </div>
        <input placeholder="tags, comma, separated" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} className={input} />
        <label className="text-sm text-muted">Thumbnail (optional)
          <input type="file" accept="image/*" onChange={(e) => setThumb(e.target.files?.[0] ?? null)} className="mt-1 block text-sm" />
        </label>
        <button className="rounded-full bg-brand py-3 font-semibold text-white">Publish</button>
        {status && (
          <div>
            <div className="h-1.5 overflow-hidden rounded-full bg-bg-3"><div className="h-full bg-brand transition-all" style={{ width: `${pct}%` }} /></div>
            <p className="mt-2 text-sm text-muted">{status}</p>
          </div>
        )}
      </form>
    </main>
  );
}
