import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Oya Build",
    short_name: "Oya Build",
    description: "Photograph a floor plan, walk through it in 3D, and get a bill of quantities in Naira.",
    start_url: "/build",
    display: "standalone",
    background_color: "#f6f4ef",
    theme_color: "#1c2430",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
