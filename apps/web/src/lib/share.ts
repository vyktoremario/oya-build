import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { type Plan, PlanSchema } from "@oya/schema";

/** Plans travel in the URL fragment, which browsers never send to the server. */
export function planToHash(plan: Plan): string {
  return `p=${compressToEncodedURIComponent(JSON.stringify(plan))}`;
}

export function planFromHash(hash: string): Plan | null {
  const m = /(?:^#?|&)p=([^&]+)/.exec(hash);
  if (!m?.[1]) return null;
  try {
    const json = decompressFromEncodedURIComponent(m[1]);
    if (!json) return null;
    const parsed = PlanSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const KEY = "oya-build:plan:v1";

export function savePlanLocally(plan: Plan): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(plan));
  } catch {
    // Private mode or quota: the plan just isn't remembered.
  }
}

export function loadLocalPlan(): Plan | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = PlanSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
