/* ============================================================
   SW.JS — Service Worker
   ============================================================ */
const CACHE_NAME = 'boxcoach-v22';

const APP_FILES = [
  './', './index.html', './style.css', './config.js', './utils.js', './data.js', './cloud.js',
  './attendance-data.js', './journal.js', './nav.js', './fighters-core.js', './assessments.js',
  './measurements.js', './calendar.js', './fighter-detail.js', './attendance.js', './reports.js',
  './exercises.js', './pdf.js', './dashboard.js', './compare.js', './settings.js', './app.js'
];

const CDN_FILES = [
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

function isLocalDev(url) {
  try {
    const u = new URL(url);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '0.0.0.0' || u.hostname === '[::1]';
  } catch (e) { return false; }
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_FILES).then(() => {
        return Promise.all(CDN_FILES.map(url => cache.add(url).catch(err => console.warn('[SW] CDN ошибка:', url))));
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || isLocalDev(req.url) || req.url.includes('supabase.co')) return;

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(response => {
        if (response && response.ok && req.url.startsWith('http')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return response;
      }).catch(() => {
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 503, statusText: 'Offline' });
      });
    })
  );
});