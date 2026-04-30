import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'RepOne',
        short_name: 'RepOne',
        start_url: '/dashboard',
        scope: '/',
        display: 'standalone',
        background_color: '#E8E1D4',
        theme_color: '#28374A',
        icons: [
          { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/api\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\.(js|css|html)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'app-shell' },
          },
          {
            urlPattern: /\.(png|jpg|svg|woff2?)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'assets' },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/webhook': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/components': resolve(__dirname, './src/shared/components'),
      '@/hooks': resolve(__dirname, './src/shared/hooks'),
      '@/lib': resolve(__dirname, './src/shared/lib'),
      '@/modules': resolve(__dirname, './src/modules'),
      '@/stores': resolve(__dirname, './src/shared/stores'),
      '@/types': resolve(__dirname, './src/shared/types'),
      '@/utils': resolve(__dirname, './src/shared/utils'),
    },
  },
})
