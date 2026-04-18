import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

const BASE = process.env.VITE_BASE_PATH ?? "/";

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "apple-touch-icon.png",
        "icon-192.png",
        "icon-512.png",
        "favicon.svg",
        "favicon-16.png",
        "favicon-32.png",
      ],
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webp,woff,woff2}"],
        navigateFallback: `${BASE.replace(/\/$/, "")}/index.html`,
      },
      devOptions: { enabled: false },
      manifest: {
        name: "Dartsly",
        short_name: "Dartsly",
        description: "Track your darts games and statistics",
        theme_color: "#0f1411",
        background_color: "#0f1411",
        display: "standalone",
        orientation: "portrait",
        start_url: BASE,
        scope: BASE,
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
