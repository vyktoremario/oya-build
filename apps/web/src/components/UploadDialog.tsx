"use client";

import { useEffect, useRef, useState } from "react";
import { ExtractionRecordingSchema, emptyPlan } from "@oya/schema";
import { postProcess } from "@oya/geometry";
import { DEFAULT_PRICE_BOOK } from "@oya/estimate";
import { useStore } from "@/lib/store";
import { loadSample } from "@/samples";

const MAX_EDGE = 1568;
const MAX_PIXELS = 1_150_000;

/** Downscale in the browser so uploads are small and the model sees a predictable size. */
async function prepareImage(file: File): Promise<{ base64: string; url: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const k = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height), Math.sqrt(MAX_PIXELS / (bitmap.width * bitmap.height)));
  const width = Math.round(bitmap.width * k);
  const height = Math.round(bitmap.height * k);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  const url = canvas.toDataURL("image/jpeg", 0.88);
  return { base64: url.split(",")[1]!, url, width, height };
}

const STAGES: Record<string, string> = {
  uploading: "Uploading the photo…",
  queued: "Sending it to the model…",
  reading: "Reading the drawing: walls, doors, windows, dimensions…",
  writing: "Writing out the geometry…",
  cleaning: "Squaring and joining walls, working out the scale…",
};

export function UploadDialog({ onClose }: { onClose: () => void }) {
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [started, setStarted] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const abort = useRef<AbortController | null>(null);
  const load = useStore((s) => s.load);

  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [started]);
  useEffect(() => () => abort.current?.abort(), []);

  const run = async (file: File) => {
    setError(null);
    setStage("uploading");
    setStarted(Date.now());
    abort.current = new AbortController();
    try {
      const img = await prepareImage(file);
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: img.base64, mediaType: "image/jpeg", width: img.width, height: img.height, apiKey: apiKey.trim() || undefined }),
        signal: abort.current.signal,
      });
      if (!res.body || !res.headers.get("content-type")?.includes("ndjson")) {
        const e = await res.json().catch(() => ({ code: "internal", message: `Server error (${res.status}).` }));
        setError({ code: e.code, message: e.message });
        setStage(null);
        return;
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "progress") setStage(ev.stage);
          if (ev.type === "error") {
            setError({ code: ev.code, message: ev.message });
            setStage(null);
            return;
          }
          if (ev.type === "result") {
            setStage("cleaning");
            const rec = ExtractionRecordingSchema.parse(ev.recording);
            if (rec.raw.drawingType === "not_a_floor_plan") {
              setError({ code: "not_plan", message: "That doesn't look like a floor plan. Try a top-down photo of the drawing." });
              setStage(null);
              return;
            }
            const out = postProcess(rec.raw, { openingSpecs: DEFAULT_PRICE_BOOK.openingSpecs });
            out.plan.name = file.name.replace(/\.[^.]+$/, "") || "Uploaded plan";
            load(out.plan, { image: { url: img.url, width: img.width, height: img.height }, flags: out.flags, extraction: { raw: rec.raw, meta: rec.meta, recorded: false } });
            onClose();
            return;
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError({ code: "network", message: "Couldn't reach the server. Check your connection and try again." });
      setStage(null);
    }
  };

  const busy = stage !== null;
  const seconds = started ? Math.round((now - started) / 1000) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="New plan">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between">
          <h2 className="text-lg font-semibold">Start a plan</h2>
          <button onClick={onClose} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]" aria-label="Close">
            ✕
          </button>
        </div>
        {busy ? (
          <div className="space-y-3 py-4" aria-live="polite">
            <div className="h-1.5 overflow-hidden rounded bg-[var(--hover)]">
              <div className="h-full w-1/3 animate-[slide_1.2s_ease-in-out_infinite] rounded bg-[var(--accent)]" />
            </div>
            <p className="text-sm">{STAGES[stage] ?? "Working…"}</p>
            <p className="text-xs text-[var(--muted)]">{seconds}s · usually 20–90 seconds. You&apos;ll check and correct the result next.</p>
          </div>
        ) : (
          <>
            <label
              className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-[var(--line)] px-4 py-8 text-center hover:border-[var(--accent)]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) void run(f);
              }}
            >
              <span className="font-medium">Upload a photo of a floor plan</span>
              <span className="text-xs text-[var(--muted)]">Hand sketch or printed plan, shot from straight above. Write a few dimensions on it so the scale can be read.</span>
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && void run(e.target.files[0])} data-testid="upload-input" />
            </label>
            {error && (
              <p className="mt-3 rounded-md bg-[var(--warn-bg)] p-2 text-sm text-[var(--warn-ink)]" role="alert">
                {error.message}
              </p>
            )}
            <div className="mt-3 text-xs">
              <button className="text-[var(--muted)] underline" onClick={() => setShowKey(!showKey)}>
                Use your own Anthropic API key
              </button>
              {showKey && (
                <div className="mt-2 space-y-1">
                  <input
                    type="password"
                    autoComplete="off"
                    placeholder="sk-ant-…"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full rounded border border-[var(--line)] px-2 py-1"
                  />
                  <p className="text-[var(--muted)]">Sent with this one request only. Not stored or logged.</p>
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--line)] pt-3 text-sm">
              <button
                className="rounded-md bg-[var(--ink)] px-3 py-1.5 text-white"
                onClick={() => {
                  const s = loadSample();
                  load(s.plan, { image: s.image, flags: s.flags, extraction: s.extraction });
                  onClose();
                }}
              >
                Load the sample bungalow
              </button>
              <button
                className="rounded-md px-3 py-1.5 hover:bg-[var(--hover)]"
                onClick={() => {
                  load(emptyPlan("Blank plan"));
                  useStore.getState().setTool("wall");
                  onClose();
                }}
              >
                Draw from scratch
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
