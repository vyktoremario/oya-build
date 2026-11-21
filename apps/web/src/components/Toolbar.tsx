"use client";

import Link from "next/link";
import { useState } from "react";
import { type Tool, useStore } from "@/lib/store";
import { planToHash } from "@/lib/share";

const TOOLS: { id: Tool; label: string; key: string }[] = [
  { id: "select", label: "Select", key: "V" },
  { id: "wall", label: "Wall", key: "W" },
  { id: "door", label: "Door", key: "D" },
  { id: "window", label: "Window", key: "N" },
  { id: "label", label: "Room name", key: "L" },
  { id: "scale", label: "Set scale", key: "S" },
];

export function Toolbar({ onNew }: { onNew: () => void }) {
  const tool = useStore((s) => s.tool);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const hasImage = useStore((s) => !!s.image);
  const showImage = useStore((s) => s.showImage);
  const name = useStore((s) => s.plan.name);
  const { setTool, undo, redo, set } = useStore.getState();
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = `${location.origin}/build#${planToHash(useStore.getState().plan)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", url);
    }
  };

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--line)] bg-white px-3 py-2">
      <Link href="/" className="font-semibold tracking-tight text-[var(--ink)]">
        Oya<span className="text-[var(--accent)]">Build</span>
      </Link>
      <span className="hidden max-w-[16rem] truncate text-sm text-[var(--muted)] md:inline">{name}</span>
      <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Plan tools">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            aria-pressed={tool === t.id}
            title={`${t.label} (${t.key})`}
            className={`rounded-md px-2 py-1 text-xs ${tool === t.id ? "bg-[var(--ink)] text-white" : "text-[var(--ink)] hover:bg-[var(--hover)]"}`}
          >
            {t.label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-[var(--line)]" />
        <button onClick={undo} disabled={!canUndo} className="rounded-md px-2 py-1 text-xs hover:bg-[var(--hover)] disabled:opacity-30" title="Undo (⌘Z)">
          Undo
        </button>
        <button onClick={redo} disabled={!canRedo} className="rounded-md px-2 py-1 text-xs hover:bg-[var(--hover)] disabled:opacity-30" title="Redo (⇧⌘Z)">
          Redo
        </button>
        {hasImage && (
          <button onClick={() => set({ showImage: !showImage })} className="rounded-md px-2 py-1 text-xs hover:bg-[var(--hover)]">
            {showImage ? "Hide photo" : "Show photo"}
          </button>
        )}
      </div>
      <div className="ml-auto flex items-center gap-1">
        <button onClick={share} className="rounded-md px-2 py-1 text-xs hover:bg-[var(--hover)]" title="Copy a link that contains this plan">
          {copied ? "Link copied" : "Share link"}
        </button>
        <button onClick={onNew} className="rounded-md bg-[var(--accent)] px-2.5 py-1 text-xs font-medium text-white hover:brightness-110">
          New plan
        </button>
      </div>
    </header>
  );
}
