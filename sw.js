/* ============================================================
   SW.JS — Service Worker для офлайн-режима
   Сохраняет файлы приложения и библиотеки, чтобы открывалось без сети.
   ============================================================ */

const CACHE_NAME = 'boxcoach-v1';

// Файлы приложения (свои)
const APP_FILES = [
  './',
  './index.html',
  './style.css',
  './data.js',
  './fighters.js',
  './calendar.js',
  './attendance.js',
  './reports.js',
  './exercises.js',
  './pdf.js',
  './app.js'
];

// Библиотеки с CDN (внешние)
const CDN_FILES = [
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Установка: скачиваем и кладём в кэш
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Сначала свои файлы (они критичны)
      return cache.addAll(APP_FILES).then(() => {
        // Потом CDN — но если не получилось, не падаем
        return Promise.all(
          CDN_FILES.map(url =>
            cache.add(url).catch(err => {
              console.warn('[SW] Не удалось закэшировать:', url, err);
            })
          )
        );
      });
    }).then(() => self.skipWaiting())
  );
});

// Активация: удаляем старые кэши
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Запросы: сначала ищем в кэше, потом в сети
self.addEventListener('fetch', event => {
  const req = event.request;

  // Нас интересуют только GET-запросы
  if (req.method !== 'GET') return;

  // Запросы к Supabase (API) — НЕ кэшируем, они должны идти в сеть
  if (req.url.includes('supabase.co')) return;

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;

      return fetch(req).then(response => {
        // Успешный ответ — кладём в кэш (только для http/https)
        if (response && response.ok && req.url.startsWith('http')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return response;
      }).catch(() => {
        // Нет сети и нет в кэше — для навигации отдаём index.html
        if (req.mode === 'navigate') {
          return caches.match('./index.html');
        }
        // Иначе — ничего не поделать
        return new Response('', { status: 503, statusText: 'Offline' });
      });
    })
  );
});