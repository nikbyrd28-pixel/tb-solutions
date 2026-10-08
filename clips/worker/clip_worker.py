#!/usr/bin/env python3
"""
CLIP ENGINE worker — one livestream in, a week of content out.

Loop:  clip_sources.status='new'
       → download (yt-dlp)            status=downloading
       → transcribe (faster-whisper)  status=transcribing
       → AI picks segments (Claude)   status=selecting
       → ffmpeg cuts + captions       status=cutting   (clip_items rendered one by one)
       → upload to Supabase storage   clip_items.status='rendered'
       → status=ready                 (review at tbsol.net/clips/, then n8n publishes)

Per source it produces:
  2 × longform   (6–15 min, 16:9)      → YouTube
  1 × linkedin   (3–9 min, 16:9)       → LinkedIn
  1 × x          (≤ 2:20, 16:9)        → X
  5 × short      (25–58 s, 9:16, burned captions) → YouTube Shorts + IG/FB Reels + TikTok

Env (see .env.example): SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY,
  WHISPER_MODEL (small), SHORT_STYLE (crop|stack), BRAND_HANDLE, POLL_SECONDS, WORK_DIR
"""
import json, os, re, shutil, subprocess, sys, time, traceback
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

SUPA = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_KEY"]
ANTHROPIC_KEY = os.environ["ANTHROPIC_API_KEY"]
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "small")
SHORT_STYLE = os.environ.get("SHORT_STYLE", "crop")        # crop = center 9:16 | stack = full frame over blurred bg
BRAND = os.environ.get("BRAND_HANDLE", "@Nickbyrd1")
POLL = int(os.environ.get("POLL_SECONDS", "60"))
WORK = Path(os.environ.get("WORK_DIR", "/work"))
ONLY_LIVE = os.environ.get("CLIP_ONLY_LIVESTREAMS", "false").lower() == "true"
BUCKET = "uploads"
MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-5")

H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}

def log(*a): print(datetime.now().strftime("%H:%M:%S"), *a, flush=True)

# ---------------- Supabase helpers ----------------
def db_get(table, params):
    r = requests.get(f"{SUPA}/rest/v1/{table}", headers=H, params=params, timeout=30); r.raise_for_status(); return r.json()

def db_patch(table, match, data):
    r = requests.patch(f"{SUPA}/rest/v1/{table}", headers={**H, "Prefer": "return=representation"}, params=match, json=data, timeout=30)
    r.raise_for_status(); return r.json()

def db_insert(table, data):
    r = requests.post(f"{SUPA}/rest/v1/{table}", headers={**H, "Prefer": "return=representation"}, json=data, timeout=30)
    r.raise_for_status(); return r.json()

def set_stage(sid, status, note=None, **extra):
    db_patch("clip_sources", {"id": f"eq.{sid}"}, {"status": status, "stage_note": note, **extra})

def upload(local: Path, dest: str, ctype: str) -> str:
    with open(local, "rb") as f:
        r = requests.post(f"{SUPA}/storage/v1/object/{BUCKET}/{dest}",
                          headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": ctype, "x-upsert": "true"},
                          data=f, timeout=600)
    r.raise_for_status()
    return f"{SUPA}/storage/v1/object/public/{BUCKET}/{dest}"

# ---------------- Pipeline steps ----------------
def download(src, d: Path) -> dict:
    out = d / "source.mp4"
    cmd = ["yt-dlp", "-f", "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080]/b",
           "--merge-output-format", "mp4", "-o", str(out), "--no-playlist", "--print-json", "--no-simulate", src["url"]]
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0: raise RuntimeError("yt-dlp: " + p.stderr[-800:])
    info = json.loads(p.stdout.strip().splitlines()[-1])
    return {"path": out, "title": info.get("title"), "duration": int(info.get("duration") or 0),
            "was_live": bool(info.get("was_live") or info.get("is_live")), "video_id": info.get("id")}

def transcribe(video: Path, d: Path) -> list:
    from faster_whisper import WhisperModel
    wav = d / "audio.wav"
    subprocess.run(["ffmpeg", "-y", "-i", str(video), "-vn", "-ac", "1", "-ar", "16000", str(wav)], check=True, capture_output=True)
    model = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
    segs, _ = model.transcribe(str(wav), vad_filter=True, word_timestamps=True)
    out = []
    for s in segs:
        out.append({"s": round(s.start, 2), "e": round(s.end, 2), "t": s.text.strip(),
                    "w": [{"s": round(w.start, 2), "e": round(w.end, 2), "t": w.word.strip()} for w in (s.words or [])]})
    return out

def ask_claude(transcript, title, duration) -> dict:
    # Compact transcript: one line per sentence with timestamps so Claude can point at exact moments.
    lines = [f"[{int(x['s'])//60:02d}:{int(x['s'])%60:02d}] {x['t']}" for x in transcript]
    text = "\n".join(lines)
    if len(text) > 350_000: text = text[:350_000] + "\n[...truncated]"
    prompt = f"""You are a short-form editor for a creator ({BRAND}). Below is the timestamped transcript of a livestream titled "{title}" ({duration//60} min).

Pick the segments that will perform best and return STRICT JSON only, no prose:
{{
 "longform": [ {{"start":"MM:SS","end":"MM:SS","title":"...","description":"...","why":"..."}}, ... 2 items, each 6–15 min, self-contained topic ],
 "linkedin": [ {{"start":"MM:SS","end":"MM:SS","title":"...","post":"...(a 3–6 line LinkedIn post, professional, no hashtags spam)","why":"..."}} ] (1 item, 3–9 min),
 "x":        [ {{"start":"MM:SS","end":"MM:SS","title":"...","post":"...(one punchy tweet under 240 chars)","why":"..."}} ] (1 item, 45 s – 2 min 20 s),
 "shorts":   [ {{"start":"MM:SS","end":"MM:SS","hook":"...(≤7 words, on-screen in the first 2 s)","title":"...(≤60 chars)","caption":"...(1–2 lines + 3–5 hashtags)","why":"..."}}, ... 5 items, 25–58 s each, strongest moment first ]
}}
Rules: cut on sentence boundaries; starts must land on a line's timestamp; a short must open mid-energy (no "so anyway"); no two shorts may overlap; titles are curiosity-driven but honest; never mention this is a clip.

TRANSCRIPT:
{text}"""
    r = requests.post("https://api.anthropic.com/v1/messages",
                      headers={"x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                      json={"model": MODEL, "max_tokens": 4000, "messages": [{"role": "user", "content": prompt}]}, timeout=300)
    r.raise_for_status()
    body = r.json()["content"][0]["text"]
    m = re.search(r"\{.*\}", body, re.S)
    plan = json.loads(m.group(0))
    for k in ("longform", "linkedin", "x", "shorts"):
        plan.setdefault(k, [])
    return plan

def ts(s: str) -> float:
    parts = [float(p) for p in str(s).split(":")]
    return parts[0]*60 + parts[1] if len(parts) == 2 else parts[0]*3600 + parts[1]*60 + parts[2]

def ass_captions(transcript, start, end, path: Path):
    """Word-grouped, centered, bold captions for the 9:16 short (burned in by ffmpeg)."""
    words = [w for seg in transcript for w in seg.get("w", []) if start <= w["s"] < end]
    def t(x):
        x = max(0, x - start); h = int(x//3600); m = int(x%3600//60); s = x%60
        return f"{h}:{m:02d}:{s:05.2f}"
    head = ("[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\n\n[V4+ Styles]\n"
            "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
            "Style: Cap,Arial,78,&H00FFFFFF,&H0000FFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,6,2,2,60,60,520,1\n\n"
            "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n")
    lines = []
    group = []
    for w in words:
        group.append(w)
        if len(group) == 3 or (group and w["t"].endswith((".", "?", "!"))):
            lines.append(f"Dialogue: 0,{t(group[0]['s'])},{t(group[-1]['e'])},Cap,,0,0,0,,{' '.join(x['t'] for x in group).upper()}")
            group = []
    if group: lines.append(f"Dialogue: 0,{t(group[0]['s'])},{t(group[-1]['e'])},Cap,,0,0,0,,{' '.join(x['t'] for x in group).upper()}")
    path.write_text(head + "\n".join(lines), encoding="utf-8")

def cut(video: Path, start: float, end: float, out: Path, vertical=False, ass: Path | None = None, hook: str | None = None):
    dur = end - start
    vf = []
    if vertical:
        if SHORT_STYLE == "stack":
            vf.append("split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=30[bg];"
                      "[b]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2")
        else:
            vf.append("scale=-2:1920,crop=1080:1920")
    if hook:
        safe = hook.replace("'", "’").replace(":", "\\:")
        vf.append(f"drawtext=text='{safe}':fontsize=82:fontcolor=white:borderw=6:bordercolor=black:x=(w-text_w)/2:y=360:enable='lt(t,2.4)'")
    if ass:
        vf.append(f"ass={ass.as_posix()}")
    cmd = ["ffmpeg", "-y", "-ss", f"{start:.2f}", "-i", str(video), "-t", f"{dur:.2f}"]
    if vf: cmd += ["-vf", ",".join(vf)]
    cmd += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(out)]
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0: raise RuntimeError("ffmpeg: " + p.stderr[-600:])

def thumb(video: Path, at: float, out: Path):
    subprocess.run(["ffmpeg", "-y", "-ss", f"{at:.2f}", "-i", str(video), "-frames:v", "1", "-q:v", "3", str(out)], capture_output=True)

def schedule(kind, i, base):
    """Stagger: longform now and +3d; LinkedIn tomorrow 9am; X in 2h; shorts one per day at noon ET starting tomorrow."""
    if kind == "longform": return base + timedelta(days=3*i)
    if kind == "linkedin": return (base + timedelta(days=1)).replace(hour=13, minute=0, second=0)   # 9am ET
    if kind == "x":        return base + timedelta(hours=2)
    return (base + timedelta(days=1+i)).replace(hour=16, minute=0, second=0)                      # noon ET

def process(src):
    sid = src["id"]; d = WORK / sid; d.mkdir(parents=True, exist_ok=True)
    try:
        set_stage(sid, "downloading", "pulling the VOD")
        info = download(src, d)
        if ONLY_LIVE and not info["was_live"]:
            set_stage(sid, "skipped", "not a livestream", title=info["title"]); return
        set_stage(sid, "transcribing", f"whisper {WHISPER_MODEL}", title=info["title"], duration_s=info["duration"],
                  was_live=info["was_live"], video_id=info["video_id"])
        tr = transcribe(info["path"], d)
        set_stage(sid, "selecting", "asking Claude for the cuts", transcript=[{k: x[k] for k in ("s", "e", "t")} for x in tr])
        plan = ask_claude(tr, info["title"], info["duration"])
        set_stage(sid, "cutting", "rendering clips", plan=plan)

        items = []
        seq = 0
        base = datetime.now(timezone.utc)
        for i, c in enumerate(plan["longform"][:2]):
            items.append(dict(kind="longform", platforms=["youtube"], start=ts(c["start"]), end=ts(c["end"]), title=c.get("title"),
                              caption=c.get("description"), why=c.get("why"), publish_at=schedule("longform", i, base)))
        for c in plan["linkedin"][:1]:
            items.append(dict(kind="linkedin", platforms=["linkedin"], start=ts(c["start"]), end=ts(c["end"]), title=c.get("title"),
                              caption=c.get("post"), why=c.get("why"), publish_at=schedule("linkedin", 0, base)))
        for c in plan["x"][:1]:
            items.append(dict(kind="x", platforms=["twitter"], start=ts(c["start"]), end=min(ts(c["end"]), ts(c["start"]) + 139), title=c.get("title"),
                              caption=c.get("post"), why=c.get("why"), publish_at=schedule("x", 0, base)))
        for i, c in enumerate(plan["shorts"][:5]):
            items.append(dict(kind="short", platforms=["youtube", "instagram", "facebook", "tiktok"], start=ts(c["start"]), end=min(ts(c["end"]), ts(c["start"]) + 59),
                              title=c.get("title"), caption=c.get("caption"), hook=c.get("hook"), why=c.get("why"), publish_at=schedule("short", i, base),
                              hashtags=re.findall(r"#\w+", c.get("caption") or "")))

        for it in items:
            seq += 1
            row = db_insert("clip_items", {"source_id": sid, "seq": seq, "kind": it["kind"], "platforms": it["platforms"],
                                           "start_s": it["start"], "end_s": it["end"], "title": it["title"], "caption": it["caption"],
                                           "hook": it.get("hook"), "why": it.get("why"), "hashtags": it.get("hashtags"),
                                           "status": "rendering", "publish_at": it["publish_at"].isoformat()})[0]
            iid = row["id"]
            try:
                out = d / f"{iid}.mp4"; jpg = d / f"{iid}.jpg"
                if it["kind"] == "short":
                    ass = d / f"{iid}.ass"; ass_captions(tr, it["start"], it["end"], ass)
                    cut(info["path"], it["start"], it["end"], out, vertical=True, ass=ass, hook=it.get("hook"))
                else:
                    cut(info["path"], it["start"], it["end"], out)
                thumb(out, 1.0, jpg)
                furl = upload(out, f"clips/{sid}/{iid}.mp4", "video/mp4")
                turl = upload(jpg, f"clips/{sid}/{iid}.jpg", "image/jpeg") if jpg.exists() else None
                db_patch("clip_items", {"id": f"eq.{iid}"}, {"status": "rendered", "file_url": furl, "thumb_url": turl})
                log("rendered", it["kind"], seq, furl)
            except Exception as e:
                db_patch("clip_items", {"id": f"eq.{iid}"}, {"status": "error", "publish_error": str(e)[:500]})
                log("item failed", iid, e)

        set_stage(sid, "ready", f"{seq} clips rendered — review at tbsol.net/clips/")
    except Exception as e:
        traceback.print_exc()
        set_stage(sid, "error", None, last_error=str(e)[:800])
    finally:
        shutil.rmtree(d, ignore_errors=True)

def main():
    log("clip worker up — polling every", POLL, "s")
    while True:
        try:
            rows = db_get("clip_sources", {"status": "eq.new", "order": "created_at.asc", "limit": "1"})
            if rows: process(rows[0]); continue
        except Exception as e:
            log("poll error", e)
        time.sleep(POLL)

if __name__ == "__main__":
    if len(sys.argv) > 1:   # one-off: python clip_worker.py <url>
        row = db_insert("clip_sources", {"url": sys.argv[1]})[0]; process(row)
    else:
        main()
