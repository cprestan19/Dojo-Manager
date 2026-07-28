import type { MetadataRoute } from "next";
import { getCachedPlatformLogo } from "@/lib/queries";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const platformLogo = await getCachedPlatformLogo().catch(() => null);
  const icon = platformLogo ?? "/logo.png";

  return {
    name: "Dojo Master",
    short_name: "DojoMaster",
    description: "Software de gestión para dojos de karate",
    start_url: "/portal",
    scope: "/",
    display: "standalone",
    background_color: "#0f0f0f",
    theme_color: "#c0392b",
    orientation: "any",
    lang: "es",
    icons: [
      { src: icon, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: icon, sizes: "512x512", type: "image/png", purpose: "any" },
    ],
    categories: ["education", "sports"],
  };
}
