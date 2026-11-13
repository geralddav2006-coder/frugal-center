import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Frugal Center",
    short_name: "Frugal",
    description: "Good deals, close to home.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [{ src: "/logo-mark.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
