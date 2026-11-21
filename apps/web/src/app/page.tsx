import Link from "next/link";
import Image from "next/image";
import evalSummary from "@/samples/eval-summary.json";

interface Summary {
  ranAt: string;
  model: string;
  categories: { name: string; n: number; wallF1: number; openingF1: number; scaleErrorPct: number | null; areaErrorPct: number; estimateErrorPct: number; costUsd: number; latencyS: number }[];
}

const pct = (x: number | null) => (x === null || !Number.isFinite(x) ? "–" : `${x.toFixed(1)}%`);

export default function Home() {
  const summary = evalSummary as Summary | null;
  return (
    <div className="min-h-dvh bg-[var(--paper)] text-[var(--ink)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <span className="font-semibold tracking-tight">
          Oya<span className="text-[var(--accent)]">Build</span>
        </span>
        <a href="https://github.com/vyktoremario/oya-build" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">
          GitHub
        </a>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="grid items-center gap-10 py-10 md:grid-cols-[1.05fr_1fr] md:py-16">
          <div>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Sketch a house.
              <br />
              Walk through it.
              <br />
              <span className="text-[var(--accent)]">Price it in Naira.</span>
            </h1>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-[var(--ink-soft)]">
              Photograph a floor plan, hand-drawn or printed. Oya Build turns it into a 3D model you can walk through and a bill of quantities a
              quantity surveyor would recognise: blocks, cement, sand, rebar, roofing, doors and windows. Move a wall and both update.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/build?sample=1" className="rounded-lg bg-[var(--accent)] px-5 py-2.5 font-medium text-white shadow-sm hover:brightness-110" data-testid="cta-sample">
                Build the sample
              </Link>
              <Link href="/build?upload=1" className="rounded-lg border border-[var(--line)] bg-white px-5 py-2.5 font-medium hover:bg-[var(--hover)]">
                Upload your own plan
              </Link>
            </div>
            <p className="mt-4 text-xs text-[var(--muted)]">Prices: Abuja, November 2026, from cited public listings. Every rate is editable.</p>
          </div>
          <Link href="/build?sample=1" className="group relative block overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-sm">
            <Image src="/samples/bungalow-sketch.jpg" alt="A hand-drawn sketch of a three-bedroom bungalow floor plan" width={1568} height={1176} className="h-auto w-full" priority />
            <span className="absolute bottom-3 right-3 rounded-md bg-[var(--ink)] px-3 py-1.5 text-sm text-white opacity-90 group-hover:opacity-100">Build this →</span>
          </Link>
        </section>

        <section className="grid gap-6 border-t border-[var(--line)] py-10 sm:grid-cols-3">
          {[
            ["1 · Extract", "A vision model reads the walls, doors, windows, room names and written dimensions. Tested geometry code squares and joins the lines and works out the scale."],
            ["2 · Correct", "Extraction is never perfect, so you check it over the photo: drag walls, fix the scale, add a missing door. Your corrected plan is what gets priced."],
            ["3 · Estimate", "Centreline take-off with the working shown: foundations, blockwork, lintel band, plaster, roof. Mix ratios, waste and every price are visible and editable."],
          ].map(([t, d]) => (
            <div key={t}>
              <h2 className="font-semibold">{t}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-soft)]">{d}</p>
            </div>
          ))}
        </section>

        <section className="border-t border-[var(--line)] py-10">
          <h2 className="font-semibold">How accurate is it?</h2>
          {summary ? (
            <>
              <p className="mt-1.5 max-w-2xl text-sm text-[var(--ink-soft)]">
                Measured on {summary.categories.reduce((s, c) => s + c.n, 0)} plans with known dimensions ({summary.model}, {summary.ranAt.slice(0, 10)}), before any human correction. Estimate error compares the bill priced from the raw extraction with the bill priced from the true plan.
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="text-left text-xs text-[var(--muted)]">
                    <tr>
                      <th className="py-1 font-medium">Plans</th>
                      <th className="py-1 font-medium">n</th>
                      <th className="py-1 font-medium">Wall F1</th>
                      <th className="py-1 font-medium">Door/window F1</th>
                      <th className="py-1 font-medium">Scale error</th>
                      <th className="py-1 font-medium">Floor area error</th>
                      <th className="py-1 font-medium">Estimate error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.categories.map((c) => (
                      <tr key={c.name} className="border-t border-[var(--line)]">
                        <td className="py-1.5">{c.name}</td>
                        <td>{c.n}</td>
                        <td>{c.wallF1.toFixed(2)}</td>
                        <td>{c.openingF1.toFixed(2)}</td>
                        <td>{pct(c.scaleErrorPct)}</td>
                        <td>{pct(c.areaErrorPct)}</td>
                        <td>{pct(c.estimateErrorPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">Medians per category. The synthetic plans are drawn by our own renderer and are much easier than real drawings; the real sketches are the number to watch. Small samples: read them as a direction, not a guarantee. Not measured: error against a real QS bill or a real build cost.</p>
            </>
          ) : (
            <p className="mt-1.5 text-sm text-[var(--ink-soft)]">Not measured yet. Numbers appear here once the evaluation set has been run.</p>
          )}
        </section>

        <footer className="border-t border-[var(--line)] py-8 text-xs text-[var(--muted)]">
          A first-pass estimate for single-storey buildings, not a substitute for a quantity surveyor or a structural engineer. Built by Victor Umeh.
        </footer>
      </main>
    </div>
  );
}
