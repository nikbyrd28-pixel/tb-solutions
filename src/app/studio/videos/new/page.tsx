"use client";
import { useState } from "react";
import { UploadCloud, Image as ImageIcon } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { createVideo } from "../../actions";

export default function NewVideo() {
  const sb = supabaseBrowser();
  const [video, setVideo] = useState<File | null>(null);
  const [thumb, setThumb] = useState<File | null>(null);
  const [kind, setKind] = useState("long");
  const [status, setStatus] = useState("");
  const [pct, setPct] = useState(0);
  const [busy, setBusy] = useState(false);

  async function up(bucket: string, file: File) {
    const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]+/g, "-")}`;
    const { error } = await sb.storage.from(bucket).upload(path, file, { contentType: file.type });
    if (error) throw error;
    return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }
  const duration = (file: File) => new Promise<number | null>((res) => {
    const v = document.createElement("video"); v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); res(Math.round(v.duration)); };
    v.onerror = () => res(null); v.src = URL.createObjectURL(file);
  });

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!video) return setStatus("Pick a video first.");
    const form = e.currentTarget;
    setBusy(true);
    try {
      setStatus("Uploading video…"); setPct(15);
      const [video_url, dur] = await Promise.all([up("videos", video), duration(video)]);
      setPct(70);
      let thumbnail_url = "";
      if (thumb) { setStatus("Uploading thumbnail…"); thumbnail_url = await up("thumbnails", thumb); }
      setPct(90); setStatus("Publishing…");
      const fd = new FormData(form);
      fd.set("video_url", video_url); fd.set("thumbnail_url", thumbnail_url); fd.set("duration_seconds", String(dur ?? ""));
      await createVideo(fd); // redirects
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`); setBusy(false);
    }
  }

  const input = "input w-full rounded-xl px-3.5 py-2.5 text-sm";
  return (
    <div className="fade-up mx-auto max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Studio</p>
      <h1 className="font-display mt-1 text-3xl font-800">New video</h1>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <label className={`card card-hover flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-dashed p-8 text-center ${video ? "border-brand/60" : ""}`}>
            <input type="file" accept="video/*" hidden onChange={(e) => setVideo(e.target.files?.[0] ?? null)} />
            <UploadCloud size={26} className="text-brand" />
            <span className="text-sm font-medium">{video ? video.name : "Drop the video here"}</span>
            <span className="text-xs text-muted">{video ? `${(video.size / 1e6).toFixed(1)} MB` : "mp4 · webm · mov"}</span>
          </label>
          <label className="card card-hover flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-dashed p-4 text-center">
            <input type="file" accept="image/*" hidden onChange={(e) => setThumb(e.target.files?.[0] ?? null)} />
            {thumb ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={URL.createObjectURL(thumb)} alt="" className="h-20 w-full rounded-lg object-cover" /> : <ImageIcon size={22} className="text-muted" />}
            <span className="text-xs text-muted">{thumb ? "Change thumbnail" : "Thumbnail"}</span>
          </label>
        </div>

        <div className="card rounded-2xl p-5">
          <div className="grid gap-4">
            <input name="title" required placeholder="Title" className={input} />
            <textarea name="description" rows={3} placeholder="Description" className={input} />
            <input name="tags" placeholder="tags, comma, separated" className={input} />
            <div className="grid grid-cols-3 gap-3">
              <label className="text-xs text-muted">Type
                <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={`${input} mt-1`}><option value="long">Long</option><option value="short">Short (feed)</option></select>
              </label>
              <label className="text-xs text-muted">Status
                <select name="visibility" defaultValue="public" className={`${input} mt-1`}><option value="public">Public</option><option value="members">Members</option><option value="unlisted">Unlisted</option><option value="draft">Draft</option></select>
              </label>
              <label className="text-xs text-muted">Access
                <select name="min_tier" defaultValue="free" className={`${input} mt-1`}><option value="free">Free</option><option value="inner_circle">Inner Circle</option><option value="day_one">Day One</option></select>
              </label>
            </div>
          </div>
        </div>

        <button disabled={busy} className="btn btn-primary h-12 disabled:opacity-60">{busy ? status : "Publish"}</button>
        {(status || busy) && (
          <div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/8"><div className="h-full bg-gradient-to-r from-brand to-brand-2 transition-all" style={{ width: `${pct}%` }} /></div>
            <p className="mt-2 text-xs text-muted">{status}</p>
          </div>
        )}
      </form>
    </div>
  );
}
