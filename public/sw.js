// public/sw.js - CricketBazar Service Worker

const CACHE = 'cricketbazar-v2'
const CACHE_URLS = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CACHE_URLS)))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)

  // Never cache ANY external API calls or Netlify functions
  if (
    url.pathname.startsWith('/.netlify/') ||
    url.hostname.includes('supabase') ||
    url.hostname.includes('cricapi') ||
    url.hostname.includes('cricbuzz') ||
    url.hostname.includes('razorpay') ||
    url.hostname.includes('vercel')
  ) {
    // Just fetch directly — no caching, no interference
    e.respondWith(fetch(e.request))
    return
  }

  // App shell — network first, fallback to cache
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(e.request, clone))
        return res
      })
      .catch(() =>
        caches.match(e.request).then(cached => cached || caches.match('/index.html'))
      )
  )
})

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting()
})
