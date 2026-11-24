import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Serves public/booklet.html at /booklet in dev. Cloudflare Pages already does this in production.
const bookletRoute: Plugin = {
  name: 'booklet-route',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url && /^\/booklet\/?(\?.*)?$/.test(req.url)) req.url = '/booklet.html'
      next()
    })
  },
}

export default defineConfig({
  plugins: [react(), bookletRoute],
  // Listen on the local network too, so a phone on the same Wi-Fi can open the dev site.
  server: { host: true },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Libraries change far less often than app code, so they get their own long-cached files.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|@remix-run)[\\/]/.test(id)) return 'react'
          if (id.includes('@supabase')) return 'supabase'
          if (/[\\/]node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'motion'
          if (id.includes('@tanstack')) return 'query'
        },
      },
    },
  },
})
