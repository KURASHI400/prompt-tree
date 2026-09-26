import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { APP_NAME } from "./src/config";
export default defineConfig({
  // HashRouter keeps every document at the mount root. Relative assets let the
  // same audited build work at / and /<repository>/ without account-specific URLs.
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      manifest: {
        name: APP_NAME,
        short_name: APP_NAME,
        id: "./",
        scope: "./",
        start_url: "./",
        lang: "ja",
        display: "standalone",
        background_color: "#f6f5f2",
        theme_color: "#f6f5f2",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: "index.html",
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 700 },
});
