"use client";

import dynamic from "next/dynamic";

// Runs in the browser only: initialise the plan from the URL / local storage, then render.
const Workspace = dynamic(
  () =>
    import("@/components/Workspace").then((m) => {
      const { openUpload } = m.initFromLocation();
      const Bound = () => <m.default openUpload={openUpload} />;
      return Bound;
    }),
  {
  ssr: false,
    loading: () => <div className="grid h-dvh place-items-center text-sm text-[var(--muted)]">Loading the workspace…</div>,
  },
);

export default function BuildClient() {
  return <Workspace />;
}
