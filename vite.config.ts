import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Quoter',
        short_name: 'Quoter',
        description: 'Organize and view market chart sets.',
        theme_color: '#151821',
        background_color: '#0b0d13',
        display: 'standalone',
        start_url: '/Quoter/',
        scope: '/Quoter/',
        capture_links: 'new-client',
        launch_handler: {
          client_mode: 'navigate-new',
        },
        icons: [
          {
            src: 'android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      } as Record<string, unknown>,
    }),
    {
      name: 'reload-config-files',
      handleHotUpdate({ file, server }) {
        if (/[\\/]src[\\/]configs[\\/]/.test(file)) {
          server.ws.send({ type: 'full-reload', path: '*' });
          return [];
        }
      },
    },
  ],
  base: '/Quoter/',
});
