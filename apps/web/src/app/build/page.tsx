import type { Metadata } from "next";
import BuildClient from "./BuildClient";

export const metadata: Metadata = { title: "Build · Oya Build" };

export default function BuildPage() {
  return <BuildClient />;
}
