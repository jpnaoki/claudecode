import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      selfDestroying: true, // TEMP durante depuração: limpa SW antigo e não cacheia (sempre versão nova)
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Tranca Online',
        short_name: 'Tranca',
        description: 'Tranca online pra jogar com os amigos, mesmo de longe.',
        theme_color: '#0A3D2A',
        background_color: '#0A3D2A',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
  },
})
