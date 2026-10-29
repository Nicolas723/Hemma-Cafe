import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// La caja corre en Windows 7 32 bits con Electron 22 (Chromium 108).
// Todo el código generado debe ser compatible con ese motor.
const TARGET = "chrome108";

export default defineConfig({
    base: "./",
    build: {
        target: TARGET,
        cssTarget: TARGET,
        chunkSizeWarningLimit: 1200,
        rollupOptions: {
            output: {
                manualChunks: {
                    firebase: ["firebase/app", "firebase/firestore", "firebase/auth"],
                    react: ["react", "react-dom"],
                },
            },
        },
    },
    esbuild: { target: TARGET },
    optimizeDeps: { esbuildOptions: { target: TARGET } },
    plugins: [
        react(),
        // PWA solo para la versión web (demo en GitHub Pages). En Electron no se registra el service worker.
        VitePWA({
            registerType: "autoUpdate",
            injectRegister: null,
            manifest: {
                name: "Hemma POS",
                short_name: "Hemma POS",
                description: "Punto de venta de Hemma Café",
                theme_color: "#5b7410",
                background_color: "#f7fbea",
                display: "standalone",
                icons: [
                    { src: "logo.png", sizes: "192x192", type: "image/png" },
                    { src: "logo.png", sizes: "512x512", type: "image/png" },
                ],
            },
            workbox: {
                globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
                maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
            },
        }),
    ],
});
