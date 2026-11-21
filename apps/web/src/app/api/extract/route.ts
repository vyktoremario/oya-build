import { z } from "zod";
import { ExtractionError, extractRaw } from "@oya/extract";
import { DAILY_CAP_USD, appKeyAllowed, checkRateLimit, recordSpend, spentToday } from "@/server/limits";

export const maxDuration = 180;

const Body = z.object({
  image: z.string().min(100).max(8 * 1024 * 1024),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  width: z.number().int().positive().max(4000),
  height: z.number().int().positive().max(4000),
  /** Optional visitor key ("bring your own key"). Used for this request only; never stored or logged. */
  apiKey: z.string().startsWith("sk-ant-").max(300).optional(),
});

export type ExtractEvent =
  | { type: "progress"; stage: "queued" | "reading" | "writing" }
  | { type: "result"; recording: unknown }
  | { type: "error"; code: string; message: string };

const json = (status: number, code: string, message: string) => Response.json({ type: "error", code, message } satisfies ExtractEvent, { status });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, "bad_request", "Send a JPEG, PNG or WebP image up to 8 MB.");
  const body = parsed.data;
  const byok = Boolean(body.apiKey);

  if (!byok) {
    if (!process.env.ANTHROPIC_API_KEY || !appKeyAllowed()) return json(503, "no_key", "Live extraction isn't configured on this deployment. Try the sample, or use your own API key.");
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!(await checkRateLimit(ip))) return json(429, "rate_limited", "You've hit the hourly limit for live extractions. Try again later, or use your own API key.");
    if ((await spentToday()) >= DAILY_CAP_USD) return json(429, "budget", "Today's free extraction budget is used up. Try the sample, or use your own API key.");
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: ExtractEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
      send({ type: "progress", stage: "queued" });
      try {
        const recording = await extractRaw({
          imageBase64: body.image,
          mediaType: body.mediaType,
          width: body.width,
          height: body.height,
          apiKey: body.apiKey ?? process.env.ANTHROPIC_API_KEY,
          signal: req.signal,
          onProgress: (stage) => send({ type: "progress", stage }),
        });
        if (!byok) await recordSpend(recording.meta.costUsd);
        send({ type: "result", recording });
      } catch (err) {
        const code = err instanceof ExtractionError ? err.code : "internal";
        const message = err instanceof ExtractionError ? err.message : "Extraction failed. Please try again.";
        if (!(err instanceof ExtractionError)) console.error("extract failed", err instanceof Error ? err.message : "unknown");
        send({ type: "error", code, message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
