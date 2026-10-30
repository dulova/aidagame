import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/aidagame/',
  plugins: [vue(), VitePWA({
    registerType: 'prompt', filename: 'sw.js',
    includeAssets: ['icons/*.svg', 'pwa/*.png'],
    manifest: {
      id: '/aidagame/', name: 'Муроблоки — маленькие игры для отдыха', short_name: 'Муроблоки',
      description: 'Спокойные головоломки без спешки', lang: 'ru', start_url: '/aidagame/', scope: '/aidagame/',
      display: 'standalone', background_color: '#fff4f1', theme_color: '#fff4f1',
      icons: [
        { src: 'pwa/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'pwa/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
      importScripts: ['cleanup-legacy.js'],
      cleanupOutdatedCaches: true, skipWaiting: false, clientsClaim: true,
      navigateFallback: 'index.html',
    },
  })],
  build: { target: 'es2022' },
});
