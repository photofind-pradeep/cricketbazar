import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    port: 5173,
    // This proxies /api/cricket to Netlify function during local development
    proxy: {
      '/api/cricket': {
        target: 'https://api.cricapi.com/v1',
        changeOrigin: true,
        rewrite: (path) => {
          // Extract query params and rewrite to CricketData API
          return path.replace('/api/cricket', '')
        },
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Add API key to every request during local dev
            const url = new URL(req.url, 'http://localhost')
            const endpoint = url.searchParams.get('endpoint') || 'currentMatches'
            const offset   = url.searchParams.get('offset')   || '0'
            const id       = url.searchParams.get('id')       || ''
            const apiKey   = process.env.CRICKETDATA_KEY || ''
            let newPath = `/${endpoint}?apikey=${apiKey}&offset=${offset}`
            if (id) newPath += `&id=${id}`
            proxyReq.path = newPath
          })
        }
      }
    }
  }
})
