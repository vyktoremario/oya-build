"use client";

import dynamic from "next/dynamic";

const Workspace = dynamic(() => import("@/components/Workspace"), {
  ssr: false,
  loading: () => <div className="grid h-dvh place-items-center text-sm text-[var(--muted)]">Loading the workspace…</div>,
});

export default function BuildClient() {
  return <Workspace />;
}
