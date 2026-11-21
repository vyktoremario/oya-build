import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Abuse and spend control for the public extraction endpoint (ADR-0005).
 * Uses Upstash Redis when configured (Vercel Marketplace sets KV_REST_API_URL/TOKEN);
 * falls back to in-memory counters for local development.
 */
const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

export const DAILY_CAP_USD = Number(process.env.EXTRACT_DAILY_CAP_USD ?? "2");
const PER_IP_PER_HOUR = Number(process.env.EXTRACT_PER_IP_PER_HOUR ?? "5");

const ratelimit = redis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(PER_IP_PER_HOUR, "1 h"), prefix: "oya:rl" }) : null;
const memoryHits = new Map<string, number[]>();
const memorySpend = new Map<string, number>();

const dayKey = () => `oya:spend:${new Date().toISOString().slice(0, 10)}`;

export async function checkRateLimit(ip: string): Promise<boolean> {
  if (ratelimit) return (await ratelimit.limit(ip)).success;
  const now = Date.now();
  const hits = (memoryHits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (hits.length >= PER_IP_PER_HOUR) return false;
  memoryHits.set(ip, [...hits, now]);
  return true;
}

/** Today's spend on the app's own key, in USD. */
export async function spentToday(): Promise<number> {
  if (redis) return Number((await redis.get<number>(dayKey())) ?? 0) / 1e6;
  return (memorySpend.get(dayKey()) ?? 0) / 1e6;
}

export async function recordSpend(usd: number): Promise<void> {
  const micro = Math.ceil(usd * 1e6);
  if (redis) {
    const key = dayKey();
    await redis.incrby(key, micro);
    await redis.expire(key, 60 * 60 * 48);
    return;
  }
  memorySpend.set(dayKey(), (memorySpend.get(dayKey()) ?? 0) + micro);
}
