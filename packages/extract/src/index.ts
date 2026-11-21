import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { type ExtractionRecording, RawExtractionSchema } from "@oya/schema";
import { PROMPT_VERSION, SYSTEM_PROMPT, userText } from "./prompt";

export { PROMPT_VERSION, SYSTEM_PROMPT } from "./prompt";

export const DEFAULT_MODEL = "claude-opus-5-5";

/** USD per million tokens (input, output). Used for the spend cap and the eval's cost numbers. */
const PRICES: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-opus-5": [5, 25],
  "claude-opus-4-8": [5, 25],
  "claude-sonnet-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};

export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const [i, o] = PRICES[model] ?? PRICES[DEFAULT_MODEL]!;
  return (inputTokens * i + outputTokens * o) / 1e6;
}

export class ExtractionError extends Error {
  constructor(
    message: string,
    readonly code: "refusal" | "truncated" | "invalid_output" | "api",
  ) {
    super(message);
  }
}

export interface ExtractOptions {
  imageBase64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
  apiKey?: string;
  model?: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  onProgress?: (stage: "reading" | "writing") => void;
  signal?: AbortSignal;
}

/** One vision call: image in, raw pixel-space geometry out (validated), with usage and cost. */
export async function extractRaw(opts: ExtractOptions): Promise<ExtractionRecording> {
  const client = new Anthropic({ apiKey: opts.apiKey, maxRetries: 1, timeout: 150_000 });
  const model = opts.model ?? DEFAULT_MODEL;
  const started = Date.now();
  const stream = client.beta.messages.stream(
    {
      model,
      max_tokens: 32000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: opts.effort ?? "high", format: betaZodOutputFormat(RawExtractionSchema) },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: opts.mediaType, data: opts.imageBase64 } },
            { type: "text", text: userText(opts.width, opts.height) },
          ],
        },
      ],
    },
    { signal: opts.signal },
  );
  let wroteText = false;
  opts.onProgress?.("reading");
  stream.on("streamEvent", (event) => {
    if (!wroteText && event.type === "content_block_start" && event.content_block.type === "text") {
      wroteText = true;
      opts.onProgress?.("writing");
    }
  });

  let message;
  try {
    message = await stream.finalMessage();
  } catch (err) {
    if (err instanceof Anthropic.APIError) throw new ExtractionError(`Model API error (${err.status ?? "network"}): ${err.message}`, "api");
    throw err;
  }
  if (message.stop_reason === "refusal") throw new ExtractionError("The model declined to read this image.", "refusal");
  if (message.stop_reason === "max_tokens") throw new ExtractionError("The plan was too complex to describe in one pass.", "truncated");

  let raw = message.parsed_output;
  if (!raw) {
    const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const parsed = RawExtractionSchema.safeParse(safeJson(text));
    if (!parsed.success) throw new ExtractionError("The model's answer didn't match the plan format.", "invalid_output");
    raw = parsed.data;
  }
  const servedBy = message.model;
  const inputTokens = message.usage.input_tokens + (message.usage.cache_creation_input_tokens ?? 0) + (message.usage.cache_read_input_tokens ?? 0);
  const outputTokens = message.usage.output_tokens;
  return {
    raw: { ...raw, imageWidth: opts.width, imageHeight: opts.height },
    meta: {
      model: `${servedBy} (prompt ${PROMPT_VERSION})`,
      inputTokens,
      outputTokens,
      costUsd: costUsd(servedBy, inputTokens, outputTokens),
      latencyMs: Date.now() - started,
      at: new Date().toISOString(),
    },
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
