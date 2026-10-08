import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
// GitHub Pages project path locally; configure-pages supplies the actual path in CI.
const configuredBase = process.env.PAGES_BASE_PATH ?? "/aplicativo-habitos/";
const base = configuredBase.endsWith("/")
  ? configuredBase
  : `${configuredBase}/`;
export default defineConfig({
  base,
  plugins: [
    VitePWA({
      base,
      scope: base,
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png"],
      manifest: {
        name: "Flexões · Seu ritmo",
        short_name: "Flexões",
        lang: "pt-BR",
        description: "Seu treino de flexões, uma série de cada vez.",
        theme_color: "#173e35",
        background_color: "#f5f6f0",
        display: "standalone",
        start_url: base,
        scope: base,
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
});
